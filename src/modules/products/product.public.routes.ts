import { Router } from "express";
import { z } from "zod";
import { pool } from "../../database/pool.js";
import type { RowDataPacket } from "mysql2";

interface PublicProduct extends RowDataPacket {
  product_code: string;
  product_name: string;
  application_url: string | null;
}

const productCodeSchema = z.string()
  .regex(/^[A-Z][A-Z0-9_]{1,39}$/);

export const publicProductsRouter = Router();

publicProductsRouter.get(
  "/",
  async (_req, res, next) => {
    try {
      const [rows] = await pool.execute<PublicProduct[]>(
        `
        SELECT
          product_code,
          product_name,
          application_url
        FROM products
        WHERE status = 'ACTIVE'
        ORDER BY product_name ASC
        LIMIT 100
        `
      );

      res.status(200).json({
        success: true,
        data: rows,
        count: rows.length
      });
    } catch (error) {
      next(error);
    }
  }
);

publicProductsRouter.get(
  "/:productCode",
  async (req, res, next) => {
    try {
      const parsed = productCodeSchema.safeParse(
        req.params.productCode
      );

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          code: "INVALID_PRODUCT_CODE"
        });
        return;
      }

      const [rows] = await pool.execute<PublicProduct[]>(
        `
        SELECT
          product_code,
          product_name,
          application_url
        FROM products
        WHERE product_code = ?
          AND status = 'ACTIVE'
        LIMIT 1
        `,
        [parsed.data]
      );

      const product = rows[0];

      if (!product) {
        res.status(404).json({
          success: false,
          code: "PRODUCT_NOT_FOUND"
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: product
      });
    } catch (error) {
      next(error);
    }
  }
);
