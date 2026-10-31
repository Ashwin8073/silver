import type { RowDataPacket } from "mysql2";
import { pool } from "../../database/pool.js";

interface LaunchOverviewRow extends RowDataPacket {
  plans: number;
  prices: number;
  integrations: number;
  launch_checks: number;
  trial_policies: number;
}

export async function getProductLaunchOverview(productId: number) {
  const [rows] = await pool.execute<LaunchOverviewRow[]>(
    `
    SELECT
      (
        SELECT COUNT(*)
        FROM plans
        WHERE product_id = ?
      ) AS plans,
      (
        SELECT COUNT(*)
        FROM plan_prices pp
        JOIN plans p ON p.id = pp.plan_id
        WHERE p.product_id = ?
      ) AS prices,
      (
        SELECT COUNT(*)
        FROM product_integrations
        WHERE product_id = ?
      ) AS integrations,
      (
        SELECT COUNT(*)
        FROM product_launch_checks
        WHERE product_id = ?
      ) AS launch_checks,
      (
        SELECT COUNT(*)
        FROM trial_policies
        WHERE product_id = ?
      ) AS trial_policies
    `,
    [
      productId,
      productId,
      productId,
      productId,
      productId
    ]
  );

  return rows[0];
}
