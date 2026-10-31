import { randomUUID } from "node:crypto";

import type {
  ResultSetHeader,
  RowDataPacket
} from "mysql2";

import type { PoolConnection } from "mysql2/promise";

import { pool } from "../../database/pool.js";

import {
  verifyLaunchApproverAuthority
} from "./product.launch.approval-authority.js";

interface ProductRow extends RowDataPacket {
  id: number;
  status: string;
}

interface IntegrationRow extends RowDataPacket {
  id: number;
}

export interface RegisterProductIntegrationInput {
  product_code: string;
  integration_code: string;
  api_audience: string;
  secret_reference: string | null;
}

export interface ConfigureTrialPolicyInput {
  product_code: string;
  enabled: boolean;
  trial_days: number;
}

export type ConfigurationWriteResult =
  | {
      status: "CREATED" | "UPDATED";
    }
  | {
      status:
        | "PRODUCT_NOT_FOUND"
        | "PRODUCT_NOT_EDITABLE"
        | "STAFF_FORBIDDEN"
        | "INTEGRATION_ALREADY_EXISTS"
        | "CONFLICT";
    };

export class ProductConfigurationInputError extends Error {
  constructor(code: string) {
    super(code);
    this.name = "ProductConfigurationInputError";
  }
}

const productCodePattern =
  /^[A-Z][A-Z0-9_]*$/;

const integrationCodePattern =
  /^[A-Z][A-Z0-9_]*$/;

const secretReferencePattern =
  /^[A-Za-z][A-Za-z0-9_./:-]*$/;

function validIdentifier(
  value: unknown,
  maximumLength: number,
  pattern: RegExp
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximumLength &&
    pattern.test(value)
  );
}

function validateProductCode(
  code: unknown
): asserts code is string {
  if (
    !validIdentifier(
      code,
      40,
      productCodePattern
    )
  ) {
    throw new ProductConfigurationInputError(
      "INVALID_PRODUCT_CODE"
    );
  }
}

function validateStaffId(
  staffId: number
): void {
  if (
    !Number.isSafeInteger(staffId) ||
    staffId <= 0
  ) {
    throw new ProductConfigurationInputError(
      "INVALID_STAFF_ID"
    );
  }
}

function validateIntegration(
  input: RegisterProductIntegrationInput
): void {
  validateProductCode(input.product_code);

  if (
    !validIdentifier(
      input.integration_code,
      80,
      integrationCodePattern
    )
  ) {
    throw new ProductConfigurationInputError(
      "INVALID_INTEGRATION_CODE"
    );
  }

  if (
    typeof input.api_audience !== "string" ||
    input.api_audience.length === 0 ||
    input.api_audience.length > 255 ||
    input.api_audience.trim() !==
      input.api_audience ||
    /[\u0000-\u001f\u007f]/.test(
      input.api_audience
    )
  ) {
    throw new ProductConfigurationInputError(
      "INVALID_API_AUDIENCE"
    );
  }

  if (
    input.secret_reference !== null &&
    (
      !validIdentifier(
        input.secret_reference,
        255,
        secretReferencePattern
      )
    )
  ) {
    throw new ProductConfigurationInputError(
      "INVALID_SECRET_REFERENCE"
    );
  }
}

function validateTrial(
  input: ConfigureTrialPolicyInput
): void {
  validateProductCode(input.product_code);

  if (typeof input.enabled !== "boolean") {
    throw new ProductConfigurationInputError(
      "INVALID_TRIAL_ENABLED"
    );
  }

  if (
    !Number.isSafeInteger(input.trial_days) ||
    input.trial_days < 0 ||
    input.trial_days > 65535
  ) {
    throw new ProductConfigurationInputError(
      "INVALID_TRIAL_DAYS"
    );
  }

  if (
    input.enabled &&
    input.trial_days === 0
  ) {
    throw new ProductConfigurationInputError(
      "ENABLED_TRIAL_REQUIRES_DAYS"
    );
  }
}

async function writeAudit(
  connection: PoolConnection,
  staffId: number,
  actionCode: string,
  targetType: string,
  targetReference: string,
  details: Record<string, unknown>
): Promise<void> {
  await connection.execute(
    [
      "INSERT INTO audit_logs (",
      "  actor_type, actor_reference,",
      "  action_code, target_type,",
      "  target_reference, request_id,",
      "  sanitized_details",
      ") VALUES (?, ?, ?, ?, ?, ?, ?)"
    ].join("\n"),
    [
      "STAFF",
      String(staffId),
      actionCode,
      targetType,
      targetReference,
      randomUUID(),
      JSON.stringify(details)
    ]
  );
}

async function requireEditableProduct(
  connection: PoolConnection,
  productCode: string,
  staffId: number
): Promise<
  | {
      status: "READY";
      productId: number;
    }
  | {
      status:
        | "PRODUCT_NOT_FOUND"
        | "PRODUCT_NOT_EDITABLE"
        | "STAFF_FORBIDDEN";
    }
> {
  const [products] =
    await connection.execute<ProductRow[]>(
      [
        "SELECT id, status",
        "FROM products",
        "WHERE product_code = ?",
        "FOR UPDATE"
      ].join("\n"),
      [productCode]
    );

  const product = products[0];

  if (!product) {
    return {
      status: "PRODUCT_NOT_FOUND"
    };
  }

  if (product.status !== "DRAFT") {
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
    return {
      status: "STAFF_FORBIDDEN"
    };
  }

  return {
    status: "READY",
    productId: product.id
  };
}

async function runConfigurationTransaction(
  operation: (
    connection: PoolConnection
  ) => Promise<ConfigurationWriteResult>
): Promise<ConfigurationWriteResult> {
  const connection = await pool.getConnection();

  let transactionActive = false;

  try {
    await connection.query(
      "SET SESSION time_zone = '+00:00'"
    );

    await connection.beginTransaction();
    transactionActive = true;

    const result = await operation(connection);

    if (
      result.status !== "CREATED" &&
      result.status !== "UPDATED"
    ) {
      await connection.rollback();
      transactionActive = false;

      return result;
    }

    await connection.commit();
    transactionActive = false;

    return result;
  } catch (error) {
    if (transactionActive) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Configuration transaction rollback failed",
          rollbackError
        );
      }
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ER_DUP_ENTRY"
    ) {
      return {
        status: "CONFLICT"
      };
    }

    throw error;
  } finally {
    connection.release();
  }
}

export async function registerProductIntegration(
  input: RegisterProductIntegrationInput,
  staffId: number
): Promise<ConfigurationWriteResult> {
  validateIntegration(input);
  validateStaffId(staffId);

  return runConfigurationTransaction(
    async (connection) => {
      const access = await requireEditableProduct(
        connection,
        input.product_code,
        staffId
      );

      if (access.status !== "READY") {
        return access;
      }

      const [existing] =
        await connection.execute<IntegrationRow[]>(
          [
            "SELECT id",
            "FROM product_integrations",
            "WHERE product_id = ?",
            "FOR UPDATE"
          ].join("\n"),
          [access.productId]
        );

      if (existing.length > 0) {
        return {
          status: "INTEGRATION_ALREADY_EXISTS"
        };
      }

      await connection.execute<ResultSetHeader>(
        [
          "INSERT INTO product_integrations (",
          "  product_id, integration_code,",
          "  api_audience, secret_reference,",
          "  status",
          ") VALUES (?, ?, ?, ?, 'DISABLED')"
        ].join("\n"),
        [
          access.productId,
          input.integration_code,
          input.api_audience,
          input.secret_reference
        ]
      );

      await writeAudit(
        connection,
        staffId,
        "PRODUCT_INTEGRATION_REGISTERED",
        "PRODUCT_INTEGRATION",
        input.integration_code,
        {
          product_code: input.product_code,
          integration_code: input.integration_code,
          status: "DISABLED",
          secret_reference_configured:
            input.secret_reference !== null
        }
      );

      return {
        status: "CREATED"
      };
    }
  );
}

export async function configureProductTrialPolicy(
  input: ConfigureTrialPolicyInput,
  staffId: number
): Promise<ConfigurationWriteResult> {
  validateTrial(input);
  validateStaffId(staffId);

  return runConfigurationTransaction(
    async (connection) => {
      const access = await requireEditableProduct(
        connection,
        input.product_code,
        staffId
      );

      if (access.status !== "READY") {
        return access;
      }

      await connection.execute<ResultSetHeader>(
        [
          "INSERT INTO trial_policies (",
          "  product_id, enabled, trial_days",
          ") VALUES (?, ?, ?)",
          "ON DUPLICATE KEY UPDATE",
          "  enabled = VALUES(enabled),",
          "  trial_days = VALUES(trial_days)"
        ].join("\n"),
        [
          access.productId,
          input.enabled ? 1 : 0,
          input.trial_days
        ]
      );

      await writeAudit(
        connection,
        staffId,
        "PRODUCT_TRIAL_POLICY_CONFIGURED",
        "PRODUCT_TRIAL_POLICY",
        input.product_code,
        {
          product_code: input.product_code,
          enabled: input.enabled,
          trial_days: input.trial_days
        }
      );

      return {
        status: "UPDATED"
      };
    }
  );
}
