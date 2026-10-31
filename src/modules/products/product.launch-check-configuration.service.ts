import { createHash, randomUUID } from "node:crypto";

import type {
  RowDataPacket
} from "mysql2";

import type {
  PoolConnection
} from "mysql2/promise";

import { pool } from "../../database/pool.js";

import {
  verifyLaunchApproverAuthority
} from "./product.launch.approval-authority.js";

import {
  MANDATORY_LAUNCH_CHECKS
} from "./product.launch.checklist.js";

export type LaunchCheckStatus =
  | "PENDING"
  | "FAILED"
  | "PASSED";

export interface LaunchCheckEvidence {
  reference: string;
  summary: string;
}

export interface RecordLaunchCheckInput {
  product_code: string;
  check_code: string;
  status: LaunchCheckStatus;
  evidence: LaunchCheckEvidence | null;
  attested_pass: boolean;
}

export type LaunchCheckWriteResult =
  | {
      status: "RECORDED";
      check_status: LaunchCheckStatus;
    }
  | {
      status:
        | "PRODUCT_NOT_FOUND"
        | "PRODUCT_NOT_EDITABLE"
        | "STAFF_FORBIDDEN"
        | "INVALID_EXISTING_CHECK";
    };

interface ProductRow extends RowDataPacket {
  id: number;
  status: string;
}

interface CheckRow extends RowDataPacket {
  id: number;
  status: string;
  details_json: string | null;
}

export class LaunchCheckInputError extends Error {
  constructor(code: string) {
    super(code);
    this.name = "LaunchCheckInputError";
  }
}

const productCodePattern =
  /^[A-Z][A-Z0-9_]{1,39}$/;

const allowedStatuses = new Set<string>([
  "PENDING",
  "FAILED",
  "PASSED"
]);

function validateEvidence(
  evidence: LaunchCheckEvidence | null
): void {
  if (evidence === null) {
    return;
  }

  if (
    typeof evidence !== "object" ||
    Array.isArray(evidence) ||
    typeof evidence.reference !== "string" ||
    evidence.reference.length < 3 ||
    evidence.reference.length > 500 ||
    evidence.reference.trim() !== evidence.reference ||
    /[\u0000-\u001f\u007f]/.test(evidence.reference) ||
    typeof evidence.summary !== "string" ||
    evidence.summary.trim().length < 10 ||
    evidence.summary.length > 1000 ||
    /[\u0000-\u001f\u007f]/.test(evidence.summary)
  ) {
    throw new LaunchCheckInputError(
      "INVALID_VERIFICATION_EVIDENCE"
    );
  }
}

function validateInput(
  input: RecordLaunchCheckInput,
  staffId: number
): void {
  if (
    !Number.isSafeInteger(staffId) ||
    staffId <= 0
  ) {
    throw new LaunchCheckInputError(
      "INVALID_STAFF_ID"
    );
  }

  if (
    typeof input.product_code !== "string" ||
    !productCodePattern.test(input.product_code)
  ) {
    throw new LaunchCheckInputError(
      "INVALID_PRODUCT_CODE"
    );
  }

  if (
    typeof input.check_code !== "string" ||
    !MANDATORY_LAUNCH_CHECKS.some(
      code => code === input.check_code
    )
  ) {
    throw new LaunchCheckInputError(
      "INVALID_LAUNCH_CHECK_CODE"
    );
  }

  if (!allowedStatuses.has(input.status)) {
    throw new LaunchCheckInputError(
      "INVALID_LAUNCH_CHECK_STATUS"
    );
  }

  if (typeof input.attested_pass !== "boolean") {
    throw new LaunchCheckInputError(
      "INVALID_VERIFICATION_ATTESTATION"
    );
  }

  validateEvidence(input.evidence);

  if (input.status === "PASSED") {
    if (
      input.evidence === null ||
      input.attested_pass !== true
    ) {
      throw new LaunchCheckInputError(
        "PASSED_CHECK_REQUIRES_EVIDENCE_AND_ATTESTATION"
      );
    }
  } else if (input.attested_pass) {
    throw new LaunchCheckInputError(
      "ATTESTATION_REQUIRES_PASSED_STATUS"
    );
  }
}

function encodeEvidence(
  evidence: LaunchCheckEvidence | null
): string | null {
  if (evidence === null) {
    return null;
  }

  return JSON.stringify({
    schema_version: 1,
    evidence_reference: evidence.reference,
    evidence_summary: evidence.summary
  });
}

function evidenceFingerprint(
  detailsJson: string | null
): string | null {
  if (detailsJson === null) {
    return null;
  }

  if (typeof detailsJson !== "string") {
    throw new Error("INVALID_STORED_LAUNCH_EVIDENCE");
  }

  return createHash("sha256")
    .update(detailsJson, "utf8")
    .digest("hex");
}

async function writeAudit(
  connection: PoolConnection,
  staffId: number,
  input: RecordLaunchCheckInput,
  previousStatus: string | null,
  previousEvidenceSha256: string | null,
  newEvidenceSha256: string | null
): Promise<void> {
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
      String(staffId),
      "PRODUCT_LAUNCH_CHECK_RECORDED",
      "PRODUCT_LAUNCH_CHECK",
      `${input.product_code}:${input.check_code}`,
      randomUUID(),
      JSON.stringify({
        product_code: input.product_code,
        check_code: input.check_code,
        previous_status: previousStatus,
        new_status: input.status,
        evidence_present: input.evidence !== null,
        previous_evidence_sha256: previousEvidenceSha256,
        new_evidence_sha256: newEvidenceSha256,
        evidence_changed:
          previousEvidenceSha256 !== newEvidenceSha256,
        attested_pass: input.attested_pass
      })
    ]
  );
}

export async function recordProductLaunchCheck(
  input: RecordLaunchCheckInput,
  staffId: number
): Promise<LaunchCheckWriteResult> {
  validateInput(input, staffId);

  const connection = await pool.getConnection();
  let transactionActive = false;

  try {
    await connection.query(
      "SET SESSION time_zone = '+00:00'"
    );

    await connection.beginTransaction();
    transactionActive = true;

    // Always lock the parent product before child configuration.
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
        status: "PRODUCT_NOT_EDITABLE"
      };
    }

    const authorized =
      await verifyLaunchApproverAuthority(
        connection,
        staffId
      );

    if (!authorized) {
      await connection.rollback();
      transactionActive = false;

      return {
        status: "STAFF_FORBIDDEN"
      };
    }

    const [existing] =
      await connection.execute<CheckRow[]>(
        [
          "SELECT id, status, details_json",
          "FROM product_launch_checks",
          "WHERE product_id = ?",
          "  AND check_code = ?",
          "FOR UPDATE"
        ].join("\n"),
        [product.id, input.check_code]
      );

    const oldCheck = existing[0];

    if (
      existing.length > 1 ||
      (
        oldCheck &&
        !allowedStatuses.has(oldCheck.status)
      )
    ) {
      await connection.rollback();
      transactionActive = false;

      return {
        status: "INVALID_EXISTING_CHECK"
      };
    }

    const evidenceJson =
      encodeEvidence(input.evidence);

    const previousEvidenceSha256 =
      evidenceFingerprint(
        oldCheck?.details_json ?? null
      );

    const newEvidenceSha256 =
      evidenceFingerprint(evidenceJson);

    const passed =
      input.status === "PASSED";

    // Non-PASSED states clear previous verifier and timestamp.
    // The database generates UTC microsecond timestamps.
    await connection.execute(
      [
        "INSERT INTO product_launch_checks (",
        "  product_id, check_code, status,",
        "  details_json, verified_by_staff_id,",
        "  verified_at",
        ") VALUES (?, ?, ?, ?, ?,",
        "  CASE WHEN ? = 1",
        "    THEN UTC_TIMESTAMP(6)",
        "    ELSE NULL",
        "  END",
        ")",
        "ON DUPLICATE KEY UPDATE",
        "  status = VALUES(status),",
        "  details_json = VALUES(details_json),",
        "  verified_by_staff_id =",
        "    VALUES(verified_by_staff_id),",
        "  verified_at = VALUES(verified_at)"
      ].join("\n"),
      [
        product.id,
        input.check_code,
        input.status,
        evidenceJson,
        passed ? staffId : null,
        passed ? 1 : 0
      ]
    );

    await writeAudit(
      connection,
      staffId,
      input,
      oldCheck?.status ?? null,
      previousEvidenceSha256,
      newEvidenceSha256
    );

    await connection.commit();
    transactionActive = false;

    return {
      status: "RECORDED",
      check_status: input.status
    };
  } catch (error) {
    if (transactionActive) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Launch check rollback failed",
          rollbackError
        );
      }
    }

    throw error;
  } finally {
    connection.release();
  }
}
