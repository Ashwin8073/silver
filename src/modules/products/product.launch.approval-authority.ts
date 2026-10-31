import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

interface AuthorizedStaffRow extends RowDataPacket {
  id: number;
}

export async function verifyLaunchApproverAuthority(
  connection: PoolConnection,
  actorStaffId: number
): Promise<boolean> {
  if (
    !Number.isSafeInteger(actorStaffId) ||
    actorStaffId <= 0
  ) {
    return false;
  }

  const [rows] =
    await connection.execute<AuthorizedStaffRow[]>(
      [
        "SELECT sa.id",
        "FROM staff_accounts sa",
        "INNER JOIN staff_role_assignments sra",
        "  ON sra.staff_id = sa.id",
        "INNER JOIN staff_roles sr",
        "  ON sr.id = sra.role_id",
        "WHERE sa.id = ?",
        "  AND sa.status = 'ACTIVE'",
        "  AND sr.role_code = 'SUPER_ADMIN'",
        "LIMIT 1",
        "FOR UPDATE"
      ].join("\n"),
      [actorStaffId]
    );

  return rows.length === 1;
}
