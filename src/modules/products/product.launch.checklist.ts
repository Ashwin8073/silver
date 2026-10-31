import type { RowDataPacket } from "mysql2";
import { pool } from "../../database/pool.js";

export const MANDATORY_LAUNCH_CHECKS = [
  "PRODUCT_CONFIG",
  "PLAN_PRICING",
  "INTEGRATION_READY",
  "ENTITLEMENT_READY",
  "SECURITY_REVIEW"
] as const;

export interface LaunchCheckRow extends RowDataPacket {
  check_code: string;
  status: string;
  verified_by_staff_id: number | null;
  verified_at: Date | string | null;
}

export function evaluateMandatoryLaunchChecks(
  rows: LaunchCheckRow[]
) {
  const checks = MANDATORY_LAUNCH_CHECKS.map(code => {
    const matching = rows.filter(
      row => row.check_code === code
    );

    if (matching.length === 0) {
      return {
        code,
        status: "MISSING" as const
      };
    }

    const row = matching[0]!;

    const validVerifier =
      row.verified_by_staff_id !== null &&
      Number.isSafeInteger(row.verified_by_staff_id) &&
      row.verified_by_staff_id > 0;

    const validTime =
      row.verified_at instanceof Date
        ? Number.isFinite(row.verified_at.getTime())
        : typeof row.verified_at === "string" &&
          row.verified_at.trim().length > 0 &&
          Number.isFinite(Date.parse(row.verified_at));

    const verified =
      matching.length === 1 &&
      row.status === "PASSED" &&
      validVerifier &&
      validTime;

    return {
      code,
      status: verified
        ? "VERIFIED" as const
        : "NOT_VERIFIED" as const
    };
  });

  const blockers = checks
    .filter(check => check.status !== "VERIFIED")
    .map(check => ({
      code: check.code,
      reason: check.status
    }));

  return {
    required_count: MANDATORY_LAUNCH_CHECKS.length,
    verified_count: checks.filter(
      check => check.status === "VERIFIED"
    ).length,
    all_required_rows_verified: blockers.length === 0,
    activation_enabled: false,
    checks,
    blockers,
    message:
      "Checklist records only. Independent approval and configuration validation are still required."
  };
}

export async function getMandatoryLaunchChecklist(
  productId: number
) {
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    throw new Error("INVALID_PRODUCT_ID");
  }

  const sql = [
    "SELECT",
    "  check_code,",
    "  status,",
    "  verified_by_staff_id,",
    "  verified_at",
    "FROM product_launch_checks",
    "WHERE product_id = ?"
  ].join("\n");

  const [rows] = await pool.execute<LaunchCheckRow[]>(
    sql,
    [productId]
  );

  return evaluateMandatoryLaunchChecks(rows);
}
