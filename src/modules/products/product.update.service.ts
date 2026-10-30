import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2";

import { pool } from "../../database/pool.js";
import type { UpdateProductInput } from "./product.update.schema.js";

interface ProductRecord extends RowDataPacket {
  id: number;
  product_code: string;
  status: string;
}

interface GrantRecord extends RowDataPacket {
  role_code: string;
}

export type UpdateOutcome =
  | "UPDATED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "NOT_EDITABLE";

const editableFields = [
  "product_name",
  "application_url",
  "onboarding_url"
] as const;

export async function updateDraftProduct(
  code: string,
  input: UpdateProductInput,
  staffId: number,
  roles: string[]
): Promise<UpdateOutcome> {
  const connection = await pool.getConnection();
  let transactionActive = false;

  try {
    await connection.beginTransaction();
    transactionActive = true;

    const [products] = await connection.execute<ProductRecord[]>(
      `
      SELECT id, product_code, status
      FROM products
      WHERE product_code = ?
      FOR UPDATE
      `,
      [code]
    );

    const product = products[0];

    if (!product) {
      await connection.rollback();
      transactionActive = false;
      return "NOT_FOUND";
    }

    if (!roles.includes("SUPER_ADMIN")) {
      const [grants] = await connection.execute<GrantRecord[]>(
        `
        SELECT role_code
        FROM staff_product_grants
        WHERE staff_id = ?
          AND product_id = ?
          AND role_code = 'PRODUCT_ADMIN'
          AND status = 'ACTIVE'
          AND revoked_at IS NULL
          AND (
            expires_at IS NULL
            OR expires_at > UTC_TIMESTAMP(6)
          )
        FOR UPDATE
        `,
        [staffId, product.id]
      );

      if (grants.length === 0) {
        await connection.rollback();
        transactionActive = false;
        return "FORBIDDEN";
      }
    }

    if (product.status !== "DRAFT") {
      await connection.rollback();
      transactionActive = false;
      return "NOT_EDITABLE";
    }

    const changes = editableFields.flatMap(field => {
      const value = input[field];

      return value === undefined
        ? []
        : [{ field, value }];
    });

    if (changes.length === 0) {
      throw new Error("No editable product fields provided");
    }

    const assignments = changes
      .map(change => `\`${change.field}\` = ?`)
      .join(", ");

    const values: Array<string | null | number> = changes.map(
  change => change.value
);

    await connection.execute(
      `
      UPDATE products
      SET ${assignments}
      WHERE id = ?
        AND status = 'DRAFT'
      `,
      [...values, product.id]
    );

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
        String(staffId),
        "PRODUCT_UPDATED",
        "PRODUCT",
        code,
        randomUUID(),
        JSON.stringify({
          changed_fields: changes.map(change => change.field),
          status: "DRAFT"
        })
      ]
    );

    await connection.commit();
    transactionActive = false;

    return "UPDATED";
  } catch (error) {
    if (transactionActive) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Product transaction rollback failed",
          rollbackError
        );
      }
    }

    throw error;
  } finally {
    connection.release();
  }
}


