import { RowDataPacket } from "mysql2";
import { pool } from "../../database/pool.js";

export interface StaffIdentity extends RowDataPacket {
  id: number;
  public_id: string;
  staff_name: string;
  email: string;
  status: string;
  mfa_required: number;
}

export async function findAuthorizedStaff(
  clerkSubject: string
): Promise<StaffIdentity | null> {
  const [rows] = await pool.execute<StaffIdentity[]>(
    `
    SELECT DISTINCT
      sa.id,
      sa.public_id,
      sa.staff_name,
      sa.email,
      sa.status,
      sa.mfa_required
    FROM staff_accounts sa
    INNER JOIN staff_auth_identities sai
      ON sai.staff_id = sa.id
    INNER JOIN auth_providers ap
      ON ap.id = sai.auth_provider_id
    WHERE sai.provider_subject = ?
      AND sai.provider_realm = 'STAFF'
      AND ap.provider_code = 'CLERK'
      AND ap.realm = 'STAFF'
      AND ap.enabled = 1
      AND sa.status = 'ACTIVE'
      AND sai.verified_at IS NOT NULL
    LIMIT 1
    `,
    [clerkSubject]
  );

  return rows[0] ?? null;
}

interface StaffRoleRow extends RowDataPacket {
  role_code: string;
}

export async function getStaffRoles(
  staffId: number
): Promise<string[]> {
  const [rows] = await pool.execute<StaffRoleRow[]>(
    `
    SELECT sr.role_code
    FROM staff_role_assignments sra
    INNER JOIN staff_roles sr
      ON sr.id = sra.role_id
    WHERE sra.staff_id = ?
    `,
    [staffId]
  );

  return rows.map((row) => row.role_code);
}
