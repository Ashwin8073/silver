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

interface PriceRow extends RowDataPacket {
  id: number;
}

interface IntegrationRow extends RowDataPacket {
  id: number;
  status: string;
  integration_code: string;
  api_audience: string;
}

export type ReadinessTransitionResult =
  | "UPDATED"
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_NOT_EDITABLE"
  | "STAFF_FORBIDDEN"
  | "PLAN_NOT_FOUND"
  | "PLAN_NOT_DRAFT"
  | "NO_CURRENT_PRICE"
  | "INTEGRATION_NOT_FOUND"
  | "INTEGRATION_NOT_DISABLED"
  | "INTEGRATION_NOT_CONFIGURED"
  | "CONCURRENT_MODIFICATION";

const codePattern = /^[A-Z][A-Z0-9_]{1,39}$/;
const planCodePattern = /^[A-Z][A-Z0-9_]{0,59}$/;

function validateInputs(
  productCode: string,
  staffId: number,
  planCode?: string
): void {
  if (
    typeof productCode !== "string" ||
    !codePattern.test(productCode)
  ) {
    throw new Error("INVALID_PRODUCT_CODE");
  }

  if (
    !Number.isSafeInteger(staffId) ||
    staffId <= 0
  ) {
    throw new Error("INVALID_STAFF_ID");
  }

  if (
    planCode !== undefined &&
    (
      typeof planCode !== "string" ||
      !planCodePattern.test(planCode)
    )
  ) {
    throw new Error("INVALID_PLAN_CODE");
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

async function lockDraftProduct(
  connection: PoolConnection,
  productCode: string,
  staffId: number
): Promise<
  | { productId: number }
  | { error: ReadinessTransitionResult }
> {
  const [rows] =
    await connection.execute<ProductRow[]>(
      [
        "SELECT id, status",
        "FROM products",
        "WHERE product_code = ?",
        "FOR UPDATE"
      ].join("\n"),
      [productCode]
    );

  const product = rows[0];

  if (!product) {
    return {
      error: "PRODUCT_NOT_FOUND"
    };
  }

  if (product.status !== "DRAFT") {
    return {
      error: "PRODUCT_NOT_EDITABLE"
    };
  }

  const authorized =
    await verifyLaunchApproverAuthority(
      connection,
      staffId
    );

  if (!authorized) {
    return {
      error: "STAFF_FORBIDDEN"
    };
  }

  if (await hasApprovedLaunchRequest(
    connection,
    product.id
  )) {
    return {
      error: "PRODUCT_NOT_EDITABLE"
    };
  }

  return {
    productId: product.id
  };
}

async function runTransition(
  operation: (
    connection: PoolConnection
  ) => Promise<ReadinessTransitionResult>
): Promise<ReadinessTransitionResult> {
  const connection = await pool.getConnection();
  let transactionActive = false;

  try {
    await connection.query(
      "SET SESSION time_zone = '+00:00'"
    );

    await connection.beginTransaction();
    transactionActive = true;

    const result = await operation(connection);

    if (result !== "UPDATED") {
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
          "Readiness transition rollback failed",
          rollbackError
        );
      }
    }

    throw error;
  } finally {
    connection.release();
  }
}

export async function activateDraftPlanConfiguration(
  productCode: string,
  planCode: string,
  staffId: number
): Promise<ReadinessTransitionResult> {
  validateInputs(productCode, staffId, planCode);

  return runTransition(async connection => {
    const access = await lockDraftProduct(
      connection,
      productCode,
      staffId
    );

    if ("error" in access) {
      return access.error;
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
        [access.productId, planCode]
      );

    const plan = plans[0];

    if (!plan) {
      return "PLAN_NOT_FOUND";
    }

    if (plan.status !== "DRAFT") {
      return "PLAN_NOT_DRAFT";
    }

    const [prices] =
      await connection.execute<PriceRow[]>(
        [
          "SELECT id",
          "FROM plan_prices",
          "WHERE plan_id = ?",
          "  AND valid_from <= UTC_TIMESTAMP(6)",
          "  AND (valid_until IS NULL",
          "    OR valid_until > UTC_TIMESTAMP(6))",
          "LIMIT 1",
          "FOR UPDATE"
        ].join("\n"),
        [plan.id]
      );

    if (prices.length === 0) {
      return "NO_CURRENT_PRICE";
    }

    const [update] =
      await connection.execute<ResultSetHeader>(
        [
          "UPDATE plans",
          "SET status = 'ACTIVE'",
          "WHERE id = ?",
          "  AND product_id = ?",
          "  AND status = 'DRAFT'"
        ].join("\n"),
        [plan.id, access.productId]
      );

    if (update.affectedRows !== 1) {
      return "CONCURRENT_MODIFICATION";
    }

    await writeAudit(
      connection,
      staffId,
      "PRODUCT_PLAN_CONFIGURATION_ACTIVATED",
      "PRODUCT_PLAN",
      `${productCode}:${planCode}`,
      {
        product_code: productCode,
        plan_code: planCode,
        old_status: "DRAFT",
        new_status: "ACTIVE"
      }
    );

    return "UPDATED";
  });
}

export async function enableProductIntegrationConfiguration(
  productCode: string,
  staffId: number
): Promise<ReadinessTransitionResult> {
  validateInputs(productCode, staffId);

  return runTransition(async connection => {
    const access = await lockDraftProduct(
      connection,
      productCode,
      staffId
    );

    if ("error" in access) {
      return access.error;
    }

    const [integrations] =
      await connection.execute<IntegrationRow[]>(
        [
          "SELECT id, status, integration_code, api_audience",
          "FROM product_integrations",
          "WHERE product_id = ?",
          "FOR UPDATE"
        ].join("\n"),
        [access.productId]
      );

    const integration = integrations[0];

    if (!integration || integrations.length !== 1) {
      return "INTEGRATION_NOT_FOUND";
    }

    if (integration.status !== "DISABLED") {
      return "INTEGRATION_NOT_DISABLED";
    }

    if (
      !integration.integration_code ||
      !integration.integration_code.trim() ||
      !integration.api_audience ||
      !integration.api_audience.trim()
    ) {
      return "INTEGRATION_NOT_CONFIGURED";
    }

    const [update] =
      await connection.execute<ResultSetHeader>(
        [
          "UPDATE product_integrations",
          "SET status = 'ENABLED'",
          "WHERE id = ?",
          "  AND product_id = ?",
          "  AND status = 'DISABLED'"
        ].join("\n"),
        [integration.id, access.productId]
      );

    if (update.affectedRows !== 1) {
      return "CONCURRENT_MODIFICATION";
    }

    await writeAudit(
      connection,
      staffId,
      "PRODUCT_INTEGRATION_CONFIGURATION_ENABLED",
      "PRODUCT_INTEGRATION",
      integration.integration_code,
      {
        product_code: productCode,
        integration_code: integration.integration_code,
        old_status: "DISABLED",
        new_status: "ENABLED"
      }
    );

    return "UPDATED";
  });
}
