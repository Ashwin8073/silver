import { Router } from "express";

import {
  requireStaff,
  requireRole
} from "../auth/staff-auth.middleware.js";

import type {
  StaffContext
} from "../auth/staff-auth.middleware.js";

import {
  createProductSchema,
  productListSchema
} from "./product.schema.js";

import {
  updateProductSchema
} from "./product.update.schema.js";

import {
  getProduct,
  listProducts
} from "./product.repository.js";

import {
  canReadProduct,
  hasGlobalProductReadAccess
} from "./product.policy.js";

import {
  createProduct,
  ProductConflictError
} from "./product.service.js";

import {
  updateDraftProduct
} from "./product.update.service.js";

export const productsRouter = Router();

productsRouter.use(requireStaff);

const productCodeRegex = /^[A-Z][A-Z0-9_]{1,39}$/;

productsRouter.get(
  "/",
  async (req, res, next) => {
    try {
      const parsed = productListSchema.safeParse(req.query);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          code: "VALIDATION_ERROR",
          errors: parsed.error.issues
        });
        return;
      }

      const staff = res.locals.staff as StaffContext;

      const globalRead = hasGlobalProductReadAccess(
        staff.roles
      );

      const result = await listProducts(
        parsed.data.limit,
        parsed.data.cursor,
        parsed.data.status,
        globalRead ? undefined : staff.id
      );

      res.status(200).json({
        success: true,
        data: result.items,
        next_cursor: result.next_cursor
      });
    } catch (error) {
      next(error);
    }
  }
);

productsRouter.get(
  "/:productCode",
  async (req, res, next) => {
    try {
      const code = req.params.productCode;

      if (
        typeof code !== "string" ||
        !productCodeRegex.test(code)
      ) {
        res.status(400).json({
          success: false,
          code: "INVALID_PRODUCT_CODE"
        });
        return;
      }

      const product = await getProduct(code);

      if (!product) {
        res.status(404).json({
          success: false,
          code: "PRODUCT_NOT_FOUND"
        });
        return;
      }

      const staff = res.locals.staff as StaffContext;

      const allowed = await canReadProduct(
        staff.id,
        staff.roles,
        product.id
      );

      if (!allowed) {
        res.status(403).json({
          success: false,
          code: "PRODUCT_ACCESS_DENIED"
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

productsRouter.post(
  "/",
  requireRole("SUPER_ADMIN"),
  async (req, res, next) => {
    try {
      const parsed = createProductSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          code: "VALIDATION_ERROR",
          errors: parsed.error.issues
        });
        return;
      }

      const staff = res.locals.staff as StaffContext;

      const product = await createProduct(
        parsed.data,
        staff.id
      );

      res.status(201).json({
        success: true,
        data: product
      });
    } catch (error) {
      if (error instanceof ProductConflictError) {
        res.status(409).json({
          success: false,
          code: "PRODUCT_ALREADY_EXISTS"
        });
        return;
      }

      next(error);
    }
  }
);

productsRouter.patch(
  "/:productCode",
  async (req, res, next) => {
    try {
      const code = req.params.productCode;

      if (
        typeof code !== "string" ||
        !productCodeRegex.test(code)
      ) {
        res.status(400).json({
          success: false,
          code: "INVALID_PRODUCT_CODE"
        });
        return;
      }

      const parsed = updateProductSchema.safeParse(
        req.body
      );

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          code: "VALIDATION_ERROR",
          errors: parsed.error.issues
        });
        return;
      }

      const staff = res.locals.staff as StaffContext;

      const outcome = await updateDraftProduct(
        code,
        parsed.data,
        staff.id,
        staff.roles
      );

      if (outcome === "NOT_FOUND") {
        res.status(404).json({
          success: false,
          code: "PRODUCT_NOT_FOUND"
        });
        return;
      }

      if (outcome === "FORBIDDEN") {
        res.status(403).json({
          success: false,
          code: "PRODUCT_ACCESS_DENIED"
        });
        return;
      }

      if (outcome === "NOT_EDITABLE") {
        res.status(409).json({
          success: false,
          code: "PRODUCT_NOT_EDITABLE"
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: await getProduct(code)
      });
    } catch (error) {
      next(error);
    }
  }
);
