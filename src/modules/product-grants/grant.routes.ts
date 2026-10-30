import {
  grantListSchema,
  listProductGrants
} from "./grant.list.js";
import { Router } from "express";

import {
  requireStaff,
  requireRole,
  type StaffContext
} from "../auth/staff-auth.middleware.js";

import {
  grantCreateSchema,
  grantRevokeSchema
} from "./grant.schema.js";

import {
  assignProductGrant,
  revokeProductGrant,
  GrantError
} from "./grant.service.js";

export const productGrantsRouter = Router();

productGrantsRouter.use(requireStaff);
productGrantsRouter.use(requireRole("SUPER_ADMIN"));

function sendGrantError(
  error: unknown,
  res: import("express").Response
): boolean {
  if (!(error instanceof GrantError)) {
    return false;
  }

  res.status(error.httpStatus).json({
    success: false,
    code: error.code
  });

  return true;
}

productGrantsRouter.get(
  "/",
  async (req, res, next) => {
    const parsed = grantListSchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        errors: parsed.error.issues
      });
      return;
    }

    try {
      const result = await listProductGrants(
        parsed.data
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
productGrantsRouter.post(
  "/",
  async (req, res, next) => {
    const parsed = grantCreateSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        errors: parsed.error.issues
      });
      return;
    }

    try {
      const staff = res.locals.staff as StaffContext;

      const result = await assignProductGrant(
        parsed.data,
        staff.id
      );

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      if (!sendGrantError(error, res)) next(error);
    }
  }
);

productGrantsRouter.get(
  "/",
  async (req, res, next) => {
    const parsed = grantListSchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        errors: parsed.error.issues
      });
      return;
    }

    try {
      const result = await listProductGrants(
        parsed.data
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
productGrantsRouter.post(
  "/:grantId/revoke",
  async (req, res, next) => {
    const grantId = Number(req.params.grantId);

    if (
      !Number.isSafeInteger(grantId) ||
      grantId < 1
    ) {
      res.status(400).json({
        success: false,
        code: "INVALID_GRANT_ID"
      });
      return;
    }

    const parsed = grantRevokeSchema.safeParse(
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

    try {
      const staff = res.locals.staff as StaffContext;

      const result = await revokeProductGrant(
        grantId,
        parsed.data.expected_version,
        staff.id
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      if (!sendGrantError(error, res)) next(error);
    }
  }
);

