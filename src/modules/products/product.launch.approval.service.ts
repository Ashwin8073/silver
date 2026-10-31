import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { pool } from "../../database/pool.js";
import {
  evaluateLaunchApprovalAction
} from "./product.launch.approval-policy.js";

import type {
  LaunchApprovalAction,
  LaunchApprovalRequest
} from "./product.launch.approval-policy.js";

interface ProductRow extends RowDataPacket {
  id: number;
  status: string;
}

interface ApprovalRow
  extends RowDataPacket, LaunchApprovalRequest {}

export type ApprovalTransactionOutcome =
  | { status: "RECORDED"; decision: "APPROVED" | "REJECTED" }
  | { status: "NOT_FOUND" }
  | { status: "DENIED"; reason: string };

export async function recordLaunchApprovalDecision(
  productCode: string,
  requestPublicId: string,
  action: LaunchApprovalAction,
  actorStaffId: number,
  actorRoles: string[]
): Promise<ApprovalTransactionOutcome> {
  if (
    !/^[A-Z][A-Z0-9_]{1,39}$/.test(productCode) ||
    !/^[0-9a-fA-F-]{36}$/.test(requestPublicId) ||
    !Number.isSafeInteger(actorStaffId) ||
    actorStaffId <= 0
  ) {
    return {
      status: "DENIED",
      reason: "INVALID_INPUT"
    };
  }

  if (!actorRoles.includes("SUPER_ADMIN")) {
    return {
      status: "DENIED",
      reason: "SUPER_ADMIN_REQUIRED"
    };
  }

  const connection = await pool.getConnection();
  let transactionActive = false;

  try {
    await connection.beginTransaction();
    transactionActive = true;

    const [products] = await connection.execute<ProductRow[]>(
      [
        "SELECT id, status",
        "FROM products",
        "WHERE product_code = ?",
        "FOR UPDATE"
      ].join("\n"),
      [productCode]
    );

    const product = products[0];

    if (!product) {
      await connection.rollback();
      transactionActive = false;
      return { status: "NOT_FOUND" };
    }

    const [requests] = await connection.execute<ApprovalRow[]>(
      [
        "SELECT id, product_id, operation_code,",
        "  target_type, status,",
        "  requested_by_staff_id, expires_at",
        "FROM platform_change_requests",
        "WHERE public_id = ? AND product_id = ?",
        "FOR UPDATE"
      ].join("\n"),
      [requestPublicId, product.id]
    );

    const approvalRequest = requests[0];

    if (!approvalRequest) {
      await connection.rollback();
      transactionActive = false;
      return { status: "NOT_FOUND" };
    }

    const decision = evaluateLaunchApprovalAction(
      approvalRequest,
      {
        actor_staff_id: actorStaffId,
        actor_roles: actorRoles,
        product_id: product.id,
        product_status: product.status,
        now: new Date()
      },
      action
    );

    if (!decision.allowed) {
      await connection.rollback();
      transactionActive = false;
      return {
        status: "DENIED",
        reason: decision.reason
      };
    }

    const [updated] = await connection.execute<ResultSetHeader>(
      [
        "UPDATE platform_change_requests",
        "SET status = ?,",
        "  approved_by_staff_id = ?,",
        "  approved_at = CASE",
        "    WHEN ? = 'APPROVED' THEN UTC_TIMESTAMP(6)",
        "    ELSE NULL END",
        "WHERE id = ? AND product_id = ?",
        "  AND status = 'PENDING'"
      ].join("\n"),
      [
        decision.next_status,
        decision.next_status === "APPROVED"
          ? actorStaffId
          : null,
        decision.next_status,
        approvalRequest.id,
        product.id
      ]
    );

    if (updated.affectedRows !== 1) {
      throw new Error("APPROVAL_CONCURRENT_MODIFICATION");
    }

    await connection.execute(
      [
        "INSERT INTO audit_logs (",
        "  actor_type, actor_reference, action_code,",
        "  target_type, target_reference,",
        "  request_id, sanitized_details",
        ") VALUES (?, ?, ?, ?, ?, ?, ?)"
      ].join("\n"),
      [
        "STAFF",
        String(actorStaffId),
        decision.next_status === "APPROVED"
          ? "PRODUCT_LAUNCH_REQUEST_APPROVED"
          : "PRODUCT_LAUNCH_REQUEST_REJECTED",
        "PRODUCT_LAUNCH_REQUEST",
        requestPublicId,
        randomUUID(),
        JSON.stringify({
          product_code: productCode,
          decision: decision.next_status
        })
      ]
    );

    await connection.commit();
    transactionActive = false;

    return {
      status: "RECORDED",
      decision: decision.next_status
    };
  } catch (error) {
    if (transactionActive) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Launch approval rollback failed",
          rollbackError
        );
      }
    }

    throw error;
  } finally {
    connection.release();
  }
}
