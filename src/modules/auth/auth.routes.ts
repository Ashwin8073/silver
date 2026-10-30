import { Router } from "express";

import {
  requireStaff,
  requireRole
} from "./staff-auth.middleware.js";

import type {
  StaffContext
} from "./staff-auth.middleware.js";

export const staffAuthRouter = Router();

staffAuthRouter.get(
  "/me",
  requireStaff,
  (_req, res) => {
    const staff = res.locals.staff as StaffContext;

    res.status(200).json({
      success: true,
      data: staff
    });
  }
);

staffAuthRouter.get(
  "/super-admin-check",
  requireStaff,
  requireRole("SUPER_ADMIN"),
  (_req, res) => {
    res.status(200).json({
      success: true,
      message: "Super Admin access verified"
    });
  }
);
