import { randomUUID } from "node:crypto";

import type {
  ResultSetHeader,
  RowDataPacket
} from "mysql2";

import { pool } from "../../database/pool.js";
import type { GrantCreateInput } from "./grant.schema.js";

interface IdRow extends RowDataPacket {
  id: number;
}

interface GrantRow extends RowDataPacket {
  id: number;
  version_no: number | string;
  status: string;
}

export class GrantError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: number
  ) {
    super(code);
  }
}

function utcSqlDate(value: string | null | undefined) {
  if (!value) return null;

  return new Date(value)
    .toISOString()
    .replace("T", " ")
    .replace("Z", "");
}

export async function assignProductGrant(
  input: GrantCreateInput,
  actorStaffId: number
) {
  const connection = await pool.getConnection();
  let active = false;

  try {
    await connection.beginTransaction();
    active = true;

    const [products] = await connection.execute<IdRow[]>(
      `
      SELECT id
      FROM products
      WHERE product_code = ?
      FOR UPDATE
      `,
      [input.product_code]
    );

    if (!products.length) {
      throw new GrantError("PRODUCT_NOT_FOUND", 404);
    }

    const [staffRows] = await connection.execute<IdRow[]>(
      `
      SELECT id
      FROM staff_accounts
      WHERE public_id = ?
        AND status = 'ACTIVE'
      FOR UPDATE
      `,
      [input.staff_public_id]
    );

    if (!staffRows.length) {
      throw new GrantError("ACTIVE_STAFF_NOT_FOUND", 404);
    }

    const productId = products[0].id;
    const staffId = staffRows[0].id;

    const [existing] = await connection.execute<GrantRow[]>(
      `
      SELECT id, status, version_no
      FROM staff_product_grants
      WHERE staff_id = ?
        AND product_id = ?
        AND role_code = ?
      FOR UPDATE
      `,
      [staffId, productId, input.role_code]
    );

    let grantId: number;

    if (existing.length) {
      const current = existing[0];

      if (current.status !== "REVOKED") {
        throw new GrantError("GRANT_ALREADY_EXISTS", 409);
      }

      if (
        input.expected_version === undefined ||
        String(current.version_no) !== String(input.expected_version)
      ) {
        throw new GrantError("GRANT_VERSION_CONFLICT", 409);
      }

      const [reactivated] = await connection.execute<ResultSetHeader>(
        `
        UPDATE staff_product_grants
        SET
          status = 'ACTIVE',
          revoked_at = NULL,
          expires_at = ?,
          granted_at = UTC_TIMESTAMP(6),
          granted_by_staff_id = ?,
          version_no = version_no + 1
        WHERE id = ?
          AND status = 'REVOKED'
          AND version_no = ?
        `,
        [
          utcSqlDate(input.expires_at),
          actorStaffId,
          current.id,
          input.expected_version
        ]
      );

      if (reactivated.affectedRows !== 1) {
        throw new GrantError("GRANT_VERSION_CONFLICT", 409);
      }

      grantId = current.id;
    } else {
      const [created] =
        await connection.execute<ResultSetHeader>(
          `
          INSERT INTO staff_product_grants (
            staff_id,
            product_id,
            role_code,
            status,
            granted_by_staff_id,
            expires_at,
            version_no
          )
          VALUES (?, ?, ?, 'ACTIVE', ?, ?, 1)
          `,
          [
            staffId,
            productId,
            input.role_code,
            actorStaffId,
            utcSqlDate(input.expires_at)
          ]
        );

      grantId = created.insertId;
    }

    await connection.execute(
      `
      INSERT INTO audit_logs (
        actor_type,
        actor_reference,
        action_code,
        target_type,
        target_reference,
        request_id,
        sanitized_details
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        "STAFF",
        String(actorStaffId),
        "PRODUCT_GRANT_ASSIGNED",
        "STAFF_PRODUCT_GRANT",
        String(grantId),
        randomUUID(),
        JSON.stringify({
          product_code: input.product_code,
          staff_public_id: input.staff_public_id,
          role_code: input.role_code
        })
      ]
    );

    await connection.commit();
    active = false;

    return { grant_id: grantId, status: "ACTIVE" };
  } catch (error) {
    if (active) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Grant rollback failed", rollbackError);
      }
    }

    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ER_DUP_ENTRY"
    ) {
      throw new GrantError("GRANT_ALREADY_EXISTS", 409);
    }

    throw error;
  } finally {
    connection.release();
  }
}

export async function revokeProductGrant(
  grantId: number,
  expectedVersion: number,
  actorStaffId: number
) {
  const connection = await pool.getConnection();
  let active = false;

  try {
    await connection.beginTransaction();
    active = true;

    const [rows] = await connection.execute<GrantRow[]>(
      `
      SELECT id, status, version_no
      FROM staff_product_grants
      WHERE id = ?
      FOR UPDATE
      `,
      [grantId]
    );

    const grant = rows[0];

    if (!grant) {
      throw new GrantError("GRANT_NOT_FOUND", 404);
    }

    if (
      String(grant.version_no) !== String(expectedVersion)
    ) {
      throw new GrantError("GRANT_VERSION_CONFLICT", 409);
    }

    if (grant.status !== "ACTIVE") {
      throw new GrantError("GRANT_NOT_ACTIVE", 409);
    }

    const [updated] =
      await connection.execute<ResultSetHeader>(
        `
        UPDATE staff_product_grants
        SET
          status = 'REVOKED',
          revoked_at = UTC_TIMESTAMP(6),
          version_no = version_no + 1
        WHERE id = ?
          AND status = 'ACTIVE'
          AND version_no = ?
        `,
        [grantId, expectedVersion]
      );

    if (updated.affectedRows !== 1) {
      throw new GrantError("GRANT_VERSION_CONFLICT", 409);
    }

    await connection.execute(
      `
      INSERT INTO audit_logs (
        actor_type,
        actor_reference,
        action_code,
        target_type,
        target_reference,
        request_id,
        sanitized_details
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        "STAFF",
        String(actorStaffId),
        "PRODUCT_GRANT_REVOKED",
        "STAFF_PRODUCT_GRANT",
        String(grantId),
        randomUUID(),
        JSON.stringify({
          expected_version: expectedVersion
        })
      ]
    );

    await connection.commit();
    active = false;

    return {
      grant_id: grantId,
      status: "REVOKED",
      version_no: expectedVersion + 1
    };
  } catch (error) {
    if (active) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Grant rollback failed", rollbackError);
      }
    }
    throw error;
  } finally {
    connection.release();
  }
}
