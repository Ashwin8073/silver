import type { RowDataPacket } from "mysql2";
import { pool } from "../../database/pool.js";

export const PRODUCT_ADMIN = "PRODUCT_ADMIN";

interface GrantRow extends RowDataPacket {
  role_code: string;
}

export function hasGlobalProductReadAccess(
  roles: string[]
): boolean {
  return roles.includes("SUPER_ADMIN") ||
    roles.includes("AUDITOR");
}

export function hasGlobalProductWriteAccess(
  roles: string[]
): boolean {
  return roles.includes("SUPER_ADMIN");
}

export async function getActiveProductGrants(
  staffId: number,
  productId: number
): Promise<string[]> {
  const [rows] = await pool.execute<GrantRow[]>(
    `
    SELECT role_code
    FROM staff_product_grants
    WHERE staff_id = ?
      AND product_id = ?
      AND status = 'ACTIVE'
      AND revoked_at IS NULL
      AND (
        expires_at IS NULL
        OR expires_at > UTC_TIMESTAMP(6)
      )
    `,
    [staffId, productId]
  );

  return rows.map(row => row.role_code);
}

export async function canReadProduct(
  staffId: number,
  roles: string[],
  productId: number
): Promise<boolean> {
  if (hasGlobalProductReadAccess(roles)) {
    return true;
  }

  const grants = await getActiveProductGrants(
    staffId,
    productId
  );

  return grants.length > 0;
}

export async function canManageProduct(
  staffId: number,
  roles: string[],
  productId: number
): Promise<boolean> {
  if (hasGlobalProductWriteAccess(roles)) {
    return true;
  }

  const grants = await getActiveProductGrants(
    staffId,
    productId
  );

  return grants.includes(PRODUCT_ADMIN);
}
