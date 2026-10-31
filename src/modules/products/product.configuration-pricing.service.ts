import {
  hasApprovedLaunchRequest
} from "./product.approved-configuration-guard.js";
import { randomUUID } from "node:crypto";

import type {
  ResultSetHeader,
  RowDataPacket
} from "mysql2";

import type {
  PoolConnection
} from "mysql2/promise";

import { pool } from "../../database/pool.js";

import {
  verifyLaunchApproverAuthority
} from "./product.launch.approval-authority.js";

interface ProductRow extends RowDataPacket {
  id: number;
  status: string;
}

interface PlanRow extends RowDataPacket {
  id: number;
  status: string;
}

interface ExistingPriceRow extends RowDataPacket {
  id: number;
}

export interface CreateDraftPlanInput {
  product_code: string;
  plan_code: string;
  plan_name: string;
  tier_rank: number | null;
}

export interface CreateDraftPriceInput {
  product_code: string;
  plan_code: string;
  currency: string;
  billing_interval: "MONTHLY" | "YEARLY";
  amount_minor: number;
  version_no: number;
  valid_from: string;
  valid_until: string | null;
}

export type ConfigurationCreateResult =
  | {
      status: "CREATED";
      id: number;
    }
  | {
      status:
        | "PRODUCT_NOT_FOUND"
        | "PRODUCT_NOT_EDITABLE"
        | "STAFF_FORBIDDEN"
        | "PLAN_NOT_FOUND"
        | "PLAN_NOT_EDITABLE"
        | "PRICE_PERIOD_CONFLICT"
        | "CONFLICT";
    };

export class ConfigurationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationValidationError";
  }
}

const codePattern = /^[A-Z][A-Z0-9_]*$/;

const utcPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

function requireSafePositiveInteger(
  value: number,
  maximum: number,
  field: string
): void {
  if (
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > maximum
  ) {
    throw new ConfigurationValidationError(
      `INVALID_${field.toUpperCase()}`
    );
  }
}

function requireCode(
  value: string,
  maximumLength: number,
  field: string
): void {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumLength ||
    !codePattern.test(value)
  ) {
    throw new ConfigurationValidationError(
      `INVALID_${field.toUpperCase()}`
    );
  }
}

function requireUtcTimestamp(
  value: string,
  field: string
): void {
  if (
    typeof value !== "string" ||
    !utcPattern.test(value)
  ) {
    throw new ConfigurationValidationError(
      `INVALID_${field.toUpperCase()}`
    );
  }

  const parsed = new Date(value);

  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 19) !==
      value.slice(0, 19)
  ) {
    throw new ConfigurationValidationError(
      `INVALID_${field.toUpperCase()}`
    );
  }

  const year = Number(value.slice(0, 4));

  if (year < 1000 || year > 9999) {
    throw new ConfigurationValidationError(
      `INVALID_${field.toUpperCase()}`
    );
  }
}

function sqlDatetime(value: string): string {
  return value.slice(0, 10) +
    " " +
    value.slice(11, 26);
}

function validatePlan(
  input: CreateDraftPlanInput
): void {
  requireCode(input.product_code, 40, "product_code");
  requireCode(input.plan_code, 60, "plan_code");

  if (
    typeof input.plan_name !== "string" ||
    input.plan_name.trim().length === 0 ||
    input.plan_name.length > 120
  ) {
    throw new ConfigurationValidationError(
      "INVALID_PLAN_NAME"
    );
  }

  if (
    input.tier_rank !== null &&
    (
      !Number.isSafeInteger(input.tier_rank) ||
      input.tier_rank < 0 ||
      input.tier_rank > 65535
    )
  ) {
    throw new ConfigurationValidationError(
      "INVALID_TIER_RANK"
    );
  }
}

function validatePrice(
  input: CreateDraftPriceInput
): void {
  requireCode(input.product_code, 40, "product_code");
  requireCode(input.plan_code, 60, "plan_code");

  if (!/^[A-Z]{3}$/.test(input.currency)) {
    throw new ConfigurationValidationError(
      "INVALID_CURRENCY"
    );
  }

  if (
    input.billing_interval !== "MONTHLY" &&
    input.billing_interval !== "YEARLY"
  ) {
    throw new ConfigurationValidationError(
      "INVALID_BILLING_INTERVAL"
    );
  }

  requireSafePositiveInteger(
    input.version_no,
    65535,
    "version_no"
  );

  if (
    !Number.isSafeInteger(input.amount_minor) ||
    input.amount_minor < 0
  ) {
    throw new ConfigurationValidationError(
      "INVALID_AMOUNT_MINOR"
    );
  }

  requireUtcTimestamp(
    input.valid_from,
    "valid_from"
  );

  if (input.valid_until !== null) {
    requireUtcTimestamp(
      input.valid_until,
      "valid_until"
    );

    if (input.valid_until <= input.valid_from) {
      throw new ConfigurationValidationError(
        "INVALID_PRICE_PERIOD"
      );
    }
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
      "  actor_type, actor_reference, action_code,",
      "  target_type, target_reference,",
      "  request_id, sanitized_details",
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

async function lockEditableProduct(
  connection: PoolConnection,
  productCode: string,
  staffId: number
): Promise<
  | { status: "READY"; productId: number }
  | Exclude<
      ConfigurationCreateResult,
      { status: "CREATED"; id: number }
    >
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

  if (await hasApprovedLaunchRequest(
    connection,
    product.id
  )) {
    return {
      status: "PRODUCT_NOT_EDITABLE"
    };
  }

  return {
    status: "READY",
    productId: product.id
  };
}

async function executeConfigurationTransaction(
  operation: (
    connection: PoolConnection
  ) => Promise<ConfigurationCreateResult>
): Promise<ConfigurationCreateResult> {
  const connection = await pool.getConnection();

  let transactionActive = false;

  try {
    await connection.query(
      "SET SESSION time_zone = '+00:00'"
    );

    await connection.beginTransaction();

    transactionActive = true;

    const result = await operation(connection);

    if (result.status !== "CREATED") {
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

export async function createDraftPlan(
  input: CreateDraftPlanInput,
  staffId: number
): Promise<ConfigurationCreateResult> {
  validatePlan(input);

  requireSafePositiveInteger(
    staffId,
    Number.MAX_SAFE_INTEGER,
    "staff_id"
  );

  return executeConfigurationTransaction(
    async (connection) => {
      const access = await lockEditableProduct(
        connection,
        input.product_code,
        staffId
      );

      if (access.status !== "READY") {
        return access;
      }

      const [insert] =
        await connection.execute<ResultSetHeader>(
          [
            "INSERT INTO plans (",
            "  product_id, plan_code, plan_name,",
            "  tier_rank, status",
            ") VALUES (?, ?, ?, ?, 'DRAFT')"
          ].join("\n"),
          [
            access.productId,
            input.plan_code,
            input.plan_name.trim(),
            input.tier_rank
          ]
        );

      await writeAudit(
        connection,
        staffId,
        "PRODUCT_PLAN_CREATED",
        "PRODUCT_PLAN",
        `${input.product_code}:${input.plan_code}`,
        {
          product_code: input.product_code,
          plan_code: input.plan_code,
          status: "DRAFT",
          tier_rank: input.tier_rank
        }
      );

      return {
        status: "CREATED",
        id: insert.insertId
      };
    }
  );
}

export async function createDraftPlanPrice(
  input: CreateDraftPriceInput,
  staffId: number
): Promise<ConfigurationCreateResult> {
  validatePrice(input);

  requireSafePositiveInteger(
    staffId,
    Number.MAX_SAFE_INTEGER,
    "staff_id"
  );

  return executeConfigurationTransaction(
    async (connection) => {
      const access = await lockEditableProduct(
        connection,
        input.product_code,
        staffId
      );

      if (access.status !== "READY") {
        return access;
      }

      const [plans] =
        await connection.execute<PlanRow[]>(
          [
            "SELECT id, status",
            "FROM plans",
            "WHERE product_id = ?",
            "  AND plan_code = ?",
            "FOR UPDATE"
          ].join("\n"),
          [
            access.productId,
            input.plan_code
          ]
        );

      const plan = plans[0];

      if (!plan) {
        return {
          status: "PLAN_NOT_FOUND"
        };
      }

      if (plan.status !== "DRAFT") {
        return {
          status: "PLAN_NOT_EDITABLE"
        };
      }

      const validFrom =
        sqlDatetime(input.valid_from);

      const validUntil =
        input.valid_until === null
          ? null
          : sqlDatetime(input.valid_until);

      const [overlaps] =
        await connection.execute<ExistingPriceRow[]>(
          [
            "SELECT id",
            "FROM plan_prices",
            "WHERE plan_id = ?",
            "  AND currency = ?",
            "  AND billing_interval = ?",
            "  AND (valid_until IS NULL",
            "    OR valid_until > ?)",
            "  AND (? IS NULL",
            "    OR valid_from < ?)",
            "LIMIT 1",
            "FOR UPDATE"
          ].join("\n"),
          [
            plan.id,
            input.currency,
            input.billing_interval,
            validFrom,
            validUntil,
            validUntil
          ]
        );

      if (overlaps.length > 0) {
        return {
          status: "PRICE_PERIOD_CONFLICT"
        };
      }

      const [insert] =
        await connection.execute<ResultSetHeader>(
          [
            "INSERT INTO plan_prices (",
            "  plan_id, version_no, currency,",
            "  billing_interval, amount_minor,",
            "  valid_from, valid_until",
            ") VALUES (?, ?, ?, ?, ?, ?, ?)"
          ].join("\n"),
          [
            plan.id,
            input.version_no,
            input.currency,
            input.billing_interval,
            input.amount_minor,
            validFrom,
            validUntil
          ]
        );

      await writeAudit(
        connection,
        staffId,
        "PRODUCT_PLAN_PRICE_CREATED",
        "PRODUCT_PLAN_PRICE",
        `${input.product_code}:${input.plan_code}:${input.version_no}`,
        {
          product_code: input.product_code,
          plan_code: input.plan_code,
          version_no: input.version_no,
          currency: input.currency,
          billing_interval: input.billing_interval,
          amount_minor: input.amount_minor,
          valid_from: input.valid_from,
          valid_until: input.valid_until
        }
      );

      return {
        status: "CREATED",
        id: insert.insertId
      };
    }
  );
}
