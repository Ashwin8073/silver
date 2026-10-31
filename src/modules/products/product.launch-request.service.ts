import { randomUUID } from "node:crypto";

import type {
  ResultSetHeader,
  RowDataPacket
} from "mysql2";

import { pool } from "../../database/pool.js";

import {
  verifyLaunchApproverAuthority
} from "./product.launch.approval-authority.js";

import {
  readAssessedLaunchConfiguration
} from "./product.launch.approval-readiness.js";

import {
  hashLaunchRequestBody,
  verifyLaunchRequestIntegrity
} from "./product.launch.request-integrity.js";

export interface CreateLaunchRequestInput {
  product_code: string;
  idempotency_key: string;
  expires_in_seconds: number;
}

export type CreateLaunchRequestResult =
  | {
      status: "CREATED" | "EXISTING";
      request_public_id: string;
    }
  | {
      status:
        | "PRODUCT_NOT_FOUND"
        | "PRODUCT_NOT_DRAFT"
        | "STAFF_FORBIDDEN"
        | "CONFIGURATION_NOT_READY"
        | "PENDING_REQUEST_EXISTS"
        | "IDEMPOTENCY_CONFLICT";
    };

interface ProductRow extends RowDataPacket {
  id: number;
  status: string;
}

interface ExistingRequestRow extends RowDataPacket {
  public_id: string;
  product_id: number;
  operation_code: string;
  target_type: string;
  status: string;
  requested_by_staff_id: number;
  request_body_json: string;
  request_sha256: string;
  expiry_seconds: number | string | null;
  unexpired: number;
}

interface PendingRequestRow extends RowDataPacket {
  id: number;
}

const productCodePattern =
  /^[A-Z][A-Z0-9_]{1,39}$/;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateInput(
  input: CreateLaunchRequestInput,
  staffId: number
): void {
  if (
    !input ||
    typeof input.product_code !== "string" ||
    !productCodePattern.test(input.product_code)
  ) {
    throw new Error("INVALID_PRODUCT_CODE");
  }

  if (
    typeof input.idempotency_key !== "string" ||
    !uuidPattern.test(input.idempotency_key)
  ) {
    throw new Error("INVALID_IDEMPOTENCY_KEY");
  }

  if (
    !Number.isSafeInteger(staffId) ||
    staffId <= 0
  ) {
    throw new Error("INVALID_STAFF_ID");
  }

  if (
    !Number.isSafeInteger(input.expires_in_seconds) ||
    input.expires_in_seconds < 300 ||
    input.expires_in_seconds > 604800
  ) {
    throw new Error("INVALID_REQUEST_EXPIRY");
  }
}

export async function createProductLaunchRequest(
  input: CreateLaunchRequestInput,
  requestingStaffId: number
): Promise<CreateLaunchRequestResult> {
  validateInput(input, requestingStaffId);

  const connection = await pool.getConnection();
  let transactionActive = false;

  try {
    await connection.query(
      "SET SESSION time_zone = '+00:00'"
    );

    await connection.beginTransaction();
    transactionActive = true;

    // Every configuration writer must lock this parent first.
    const [products] =
      await connection.execute<ProductRow[]>(
        [
          "SELECT id, status",
          "FROM products",
          "WHERE product_code = ?",
          "FOR UPDATE"
        ].join("\n"),
        [input.product_code]
      );

    const product = products[0];

    if (!product) {
      await connection.rollback();
      transactionActive = false;

      return {
        status: "PRODUCT_NOT_FOUND"
      };
    }

    if (product.status !== "DRAFT") {
      await connection.rollback();
      transactionActive = false;

      return {
        status: "PRODUCT_NOT_DRAFT"
      };
    }

    const authorized =
      await verifyLaunchApproverAuthority(
        connection,
        requestingStaffId
      );

    if (!authorized) {
      await connection.rollback();
      transactionActive = false;

      return {
        status: "STAFF_FORBIDDEN"
      };
    }



    // Look for an earlier attempt using the same client retry key.
    const [existingRows] =
      await connection.execute<ExistingRequestRow[]>(
        [
          "SELECT public_id, product_id, operation_code,",
          "  target_type, status, requested_by_staff_id,",
          "  request_body_json, request_sha256,",
          "  TIMESTAMPDIFF(",
          "    SECOND, requested_at, expires_at",
          "  ) AS expiry_seconds,",
          "  CASE",
          "    WHEN expires_at IS NULL",
          "      OR expires_at > UTC_TIMESTAMP(6)",
          "    THEN 1 ELSE 0",
          "  END AS unexpired",
          "FROM platform_change_requests",
          "WHERE idempotency_key = ?",
          "FOR UPDATE"
        ].join("\n"),
        [input.idempotency_key]
      );

    const existing = existingRows[0];

    if (existing) {
      const integrity = verifyLaunchRequestIntegrity(
        existing.request_body_json,
        existing.request_sha256,
        input.product_code
      );

      const sameRequest =
        existing.product_id === product.id &&
        existing.operation_code === "PRODUCT_LAUNCH" &&
        existing.target_type === "PRODUCT" &&
        existing.status === "PENDING" &&
        existing.requested_by_staff_id ===
          requestingStaffId &&
        Number(existing.unexpired) === 1 &&
        existing.expiry_seconds !== null &&
        Number(existing.expiry_seconds) ===
          input.expires_in_seconds &&
        integrity.valid;

      await connection.rollback();
      transactionActive = false;

      return sameRequest
        ? {
            status: "EXISTING",
            request_public_id: existing.public_id
          }
        : {
            status: "IDEMPOTENCY_CONFLICT"
          };
    }

    // Product parent lock serializes compliant writers for
    // the same product, even without a unique pending index.
    const [pendingRows] =
      await connection.execute<PendingRequestRow[]>(
        [
          "SELECT id",
          "FROM platform_change_requests",
          "WHERE product_id = ?",
          "  AND operation_code = 'PRODUCT_LAUNCH'",
          "  AND target_type = 'PRODUCT'",
          "  AND status = 'PENDING'",
          "  AND (expires_at IS NULL",
          "    OR expires_at > UTC_TIMESTAMP(6))",
          "LIMIT 1",
          "FOR UPDATE"
        ].join("\n"),
        [product.id]
      );

    if (pendingRows.length > 0) {
      await connection.rollback();
      transactionActive = false;

      return {
        status: "PENDING_REQUEST_EXISTS"
      };
    }

    const configuration =
      await readAssessedLaunchConfiguration(
        connection,
        product.id,
        new Date()
      );

    if (
      !configuration.assessment
        .configuration_checks_passed
    ) {
      await connection.rollback();
      transactionActive = false;

      return {
        status: "CONFIGURATION_NOT_READY"
      };
    }

    const requestBody = JSON.stringify({
      schema_version: 1,
      product_code: input.product_code,
      configuration_sha256: configuration.hash
    });

    const requestHash =
      hashLaunchRequestBody(requestBody);

    const publicId = randomUUID();

    const [inserted] =
      await connection.execute<ResultSetHeader>(
        [
          "INSERT INTO platform_change_requests (",
          "  public_id, operation_code, target_type,",
          "  target_reference, product_id,",
          "  request_body_json, request_sha256,",
          "  idempotency_key, status,",
          "  requested_by_staff_id, requested_at, expires_at",
          ") VALUES (",
          "  ?, 'PRODUCT_LAUNCH', 'PRODUCT',",
          "  ?, ?, ?, ?, ?, 'PENDING', ?, UTC_TIMESTAMP(6),",
          "  DATE_ADD(",
          "    UTC_TIMESTAMP(6),",
          "    INTERVAL ? SECOND",
          "  )",
          ")"
        ].join("\n"),
        [
          publicId,
          input.product_code,
          product.id,
          requestBody,
          requestHash,
          input.idempotency_key,
          requestingStaffId,
          input.expires_in_seconds
        ]
      );

    if (inserted.affectedRows !== 1) {
      throw new Error("LAUNCH_REQUEST_INSERT_FAILED");
    }

    await connection.execute(
      [
        "INSERT INTO audit_logs (",
        "  actor_type, actor_reference, action_code,",
        "  target_type, target_reference,",
        "  request_id, sanitized_details",
        ") VALUES (?, ?, ?, ?, ?, ?, ?)"
      ].join("\n"),
      [
        "STAFF",
        String(requestingStaffId),
        "PRODUCT_LAUNCH_REQUEST_CREATED",
        "PRODUCT_LAUNCH_REQUEST",
        publicId,
        randomUUID(),
        JSON.stringify({
          product_code: input.product_code,
          configuration_sha256: configuration.hash,
          expiry_seconds: input.expires_in_seconds
        })
      ]
    );

    await connection.commit();
    transactionActive = false;

    return {
      status: "CREATED",
      request_public_id: publicId
    };
  } catch (error) {
    if (transactionActive) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Launch request rollback failed",
          rollbackError
        );
      }
    }

    throw error;
  } finally {
    connection.release();
  }
}
