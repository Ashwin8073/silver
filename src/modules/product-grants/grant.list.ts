import { z } from "zod";
import type { RowDataPacket } from "mysql2";

import { pool } from "../../database/pool.js";

export const grantListSchema = z.object({
  product_code: z.string()
    .regex(/^[A-Z][A-Z0-9_]{1,39}$/),

  status: z.enum([
    "ACTIVE",
    "REVOKED"
  ]).optional(),

  limit: z.coerce.number()
    .int()
    .min(1)
    .max(100)
    .default(20),

  cursor: z.coerce.number()
    .int()
    .nonnegative()
    .safe()
    .default(0)
}).strict();

export type GrantListInput =
  z.infer<typeof grantListSchema>;

interface GrantListRow extends RowDataPacket {
  id: number;
  staff_public_id: string;
  staff_name: string;
  role_code: string;
  status: string;
  version_no: number;
  effective_status: "ACTIVE" | "EXPIRED" | "REVOKED";
  granted_at: Date | string;
  revoked_at: Date | string | null;
  expires_at: Date | string | null;
}

export async function listProductGrants(
  input: GrantListInput
) {
  const params: Array<string | number> = [
    input.product_code,
    input.cursor
  ];

  let sql = `
    SELECT
      spg.id,
      sa.public_id AS staff_public_id,
      sa.staff_name,
      spg.role_code,
      spg.status,
      CASE
        WHEN spg.status = 'REVOKED'
          THEN 'REVOKED'
        WHEN spg.expires_at IS NOT NULL
          AND spg.expires_at <= UTC_TIMESTAMP(6)
          THEN 'EXPIRED'
        ELSE 'ACTIVE'
      END AS effective_status,
      spg.version_no,
      spg.granted_at,
      spg.revoked_at,
      spg.expires_at
    FROM staff_product_grants spg
    INNER JOIN products p
      ON p.id = spg.product_id
    INNER JOIN staff_accounts sa
      ON sa.id = spg.staff_id
    WHERE p.product_code = ?
      AND spg.id > ?
  `;

  if (input.status) {
    sql += " AND spg.status = ?";
    params.push(input.status);
  }

  sql += `
    ORDER BY spg.id ASC
    LIMIT ?
  `;

  params.push(input.limit + 1);

  const [rows] = await pool.query<GrantListRow[]>(
    sql,
    params
  );

  const hasMore = rows.length > input.limit;
  const items = rows.slice(0, input.limit);

  return {
    items,
    next_cursor: hasMore
      ? items[items.length - 1]?.id ?? null
      : null
  };
}

