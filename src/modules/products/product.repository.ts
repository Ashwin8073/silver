import type { RowDataPacket } from "mysql2";
import { pool } from "../../database/pool.js";

export interface ProductRow extends RowDataPacket {
  id: number;
  product_code: string;
  product_name: string;
  application_url: string | null;
  onboarding_url: string | null;
  provisioning_mode: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export async function listProducts(
  limit: number,
  cursor: number,
  status?: string,
  staffId?: number
) {
  const params: Array<string | number> = [cursor];

  let sql = `
    SELECT p.*
    FROM products p
    WHERE p.id > ?
  `;

  if (status) {
    sql += " AND p.status = ?";
    params.push(status);
  }

  if (staffId !== undefined) {
    sql += `
      AND EXISTS (
        SELECT 1
        FROM staff_product_grants spg
        WHERE spg.product_id = p.id
          AND spg.staff_id = ?
          AND spg.status = 'ACTIVE'
          AND spg.revoked_at IS NULL
          AND (
            spg.expires_at IS NULL
            OR spg.expires_at > UTC_TIMESTAMP(6)
          )
      )
    `;

    params.push(staffId);
  }

  sql += " ORDER BY p.id ASC LIMIT ?";
  params.push(limit + 1);

  const [rows] = await pool.query<ProductRow[]>(
    sql,
    params
  );

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);

  return {
    items,
    next_cursor: hasMore
      ? items[items.length - 1]?.id ?? null
      : null
  };
}
export async function getProduct(
  code: string
): Promise<ProductRow | null> {
  const [rows] = await pool.execute<ProductRow[]>(
    `
    SELECT *
    FROM products
    WHERE product_code = ?
    LIMIT 1
    `,
    [code]
  );

  return rows[0] ?? null;
}

