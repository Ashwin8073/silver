import { randomUUID } from "node:crypto";
import type { ResultSetHeader } from "mysql2";

import { pool } from "../../database/pool.js";
import { getProduct } from "./product.repository.js";

import type {
  CreateProductInput
} from "./product.schema.js";

export class ProductConflictError extends Error {
  constructor() {
    super("Product code already exists");
    this.name = "ProductConflictError";
  }
}

export async function createProduct(
  input: CreateProductInput,
  staffId: number
) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.execute<ResultSetHeader>(
      `
      INSERT INTO products (
        product_code,
        product_name,
        application_url,
        provisioning_mode,
        status
      )
      VALUES (?, ?, ?, ?, 'DRAFT')
      `,
      [
        input.product_code,
        input.product_name,
        input.application_url ?? null,
        input.provisioning_mode
      ]
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
        "PRODUCT_CREATED",
        "PRODUCT",
        input.product_code,
        randomUUID(),
        JSON.stringify({
          product_code: input.product_code,
          status: "DRAFT"
        })
      ]
    );

    await connection.commit();

    return await getProduct(input.product_code);
  } catch (error) {
    await connection.rollback();

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ER_DUP_ENTRY"
    ) {
      throw new ProductConflictError();
    }

    throw error;
  } finally {
    connection.release();
  }
}
