import { getAuth } from "@clerk/express";
import type {
  Request,
  Response,
  NextFunction
} from "express";

import {
  findAuthorizedStaff,
  getStaffRoles
} from "../staff/staff.repository.js";

export interface StaffContext {
  id: number;
  publicId: string;
  name: string;
  email: string;
  roles: string[];
}

export async function requireStaff(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auth = getAuth(req);

    if (
      !auth.isAuthenticated ||
      !auth.userId ||
      auth.tokenType !== "session_token"
    ) {
      res.status(401).json({
        success: false,
        code: "UNAUTHENTICATED",
        message: "Valid STAFF session required"
      });
      return;
    }

    const staff = await findAuthorizedStaff(
      auth.userId
    );

    if (!staff) {
      res.status(403).json({
        success: false,
        code: "STAFF_ACCESS_DENIED",
        message: "Staff access not authorized"
      });
      return;
    }

    const roles = await getStaffRoles(staff.id);

    if (roles.length === 0) {
      res.status(403).json({
        success: false,
        code: "NO_STAFF_ROLE",
        message: "No active staff role assigned"
      });
      return;
    }

    const context: StaffContext = {
      id: staff.id,
      publicId: staff.public_id,
      name: staff.staff_name,
      email: staff.email,
      roles
    };

    res.locals.staff = context;

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(
  ...allowedRoles: string[]
) {
  return (
    _req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const staff = res.locals.staff as
      | StaffContext
      | undefined;

    if (
      !staff ||
      !allowedRoles.some((role) =>
        staff.roles.includes(role)
      )
    ) {
      res.status(403).json({
        success: false,
        code: "INSUFFICIENT_PERMISSIONS",
        message: "Permission denied"
      });
      return;
    }

    next();
  };
}
