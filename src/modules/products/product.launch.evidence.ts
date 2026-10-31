import type { RowDataPacket } from "mysql2";
import { pool } from "../../database/pool.js";

export interface LaunchEvidenceRow extends RowDataPacket {
  active_plans: number;
  current_prices: number;
  enabled_integrations: number;
  verified_launch_checks: number;
  unresolved_launch_checks: number;
}

export async function getProductLaunchEvidence(
  productId: number
): Promise<LaunchEvidenceRow> {
  const sql = [
    "SELECT",
    "  (",
    "    SELECT COUNT(*)",
    "    FROM plans",
    "    WHERE product_id = ?",
    "      AND status = 'ACTIVE'",
    "  ) AS active_plans,",
    "  (",
    "    SELECT COUNT(*)",
    "    FROM plan_prices pp",
    "    JOIN plans p ON p.id = pp.plan_id",
    "    WHERE p.product_id = ?",
    "      AND p.status = 'ACTIVE'",
    "      AND pp.valid_from <= UTC_TIMESTAMP(6)",
    "      AND (",
    "        pp.valid_until IS NULL",
    "        OR pp.valid_until > UTC_TIMESTAMP(6)",
    "      )",
    "  ) AS current_prices,",
    "  (",
    "    SELECT COUNT(*)",
    "    FROM product_integrations",
    "    WHERE product_id = ?",
    "      AND status IN ('ACTIVE', 'ENABLED')",
    "  ) AS enabled_integrations,",
    "  (",
    "    SELECT COUNT(*)",
    "    FROM product_launch_checks",
    "    WHERE product_id = ?",
    "      AND status = 'PASSED'",
    "      AND verified_by_staff_id IS NOT NULL",
    "      AND verified_at IS NOT NULL",
    "  ) AS verified_launch_checks,",
    "  (",
    "    SELECT COUNT(*)",
    "    FROM product_launch_checks",
    "    WHERE product_id = ?",
    "      AND (",
    "        status <> 'PASSED'",
    "        OR verified_by_staff_id IS NULL",
    "        OR verified_at IS NULL",
    "      )",
    "  ) AS unresolved_launch_checks"
  ].join("\n");

  const [rows] = await pool.execute<LaunchEvidenceRow[]>(
    sql,
    [
      productId,
      productId,
      productId,
      productId,
      productId
    ]
  );

  if (!rows[0]) {
    throw new Error("LAUNCH_EVIDENCE_UNAVAILABLE");
  }

  return rows[0];
}
