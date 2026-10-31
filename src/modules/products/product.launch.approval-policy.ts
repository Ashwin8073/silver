export type LaunchApprovalAction =
  | "APPROVE"
  | "REJECT";

export interface LaunchApprovalRequest {
  id: number;
  product_id: number;
  operation_code: string;
  target_type: string;
  status: string;
  requested_by_staff_id: number;
  expires_at: Date | null;
}

export interface LaunchApprovalContext {
  actor_staff_id: number;
  actor_roles: string[];
  product_id: number;
  product_status: string;
  now: Date;
}

export type LaunchApprovalDecision =
  | {
      allowed: true;
      next_status: "APPROVED" | "REJECTED";
    }
  | {
      allowed: false;
      reason: string;
    };

export function evaluateLaunchApprovalAction(
  request: LaunchApprovalRequest,
  context: LaunchApprovalContext,
  action: LaunchApprovalAction
): LaunchApprovalDecision {
  const deny = (reason: string): LaunchApprovalDecision => ({
    allowed: false,
    reason
  });

  if (
    !Number.isSafeInteger(context.actor_staff_id) ||
    context.actor_staff_id <= 0 ||
    !context.actor_roles.includes("SUPER_ADMIN")
  ) {
    return deny("SUPER_ADMIN_REQUIRED");
  }

  if (
    !Number.isSafeInteger(request.id) ||
    request.id <= 0 ||
    !Number.isSafeInteger(request.product_id) ||
    request.product_id <= 0 ||
    request.product_id !== context.product_id ||
    request.operation_code !== "PRODUCT_LAUNCH" ||
    request.target_type !== "PRODUCT"
  ) {
    return deny("INVALID_LAUNCH_REQUEST");
  }

  if (request.status !== "PENDING") {
    return deny("REQUEST_NOT_PENDING");
  }

  if (context.product_status !== "DRAFT") {
    return deny("PRODUCT_NOT_DRAFT");
  }

  if (
    !(context.now instanceof Date) ||
    !Number.isFinite(context.now.getTime())
  ) {
    return deny("INVALID_ASSESSMENT_TIME");
  }

  if (request.expires_at !== null) {
    if (
      !(request.expires_at instanceof Date) ||
      !Number.isFinite(request.expires_at.getTime())
    ) {
      return deny("INVALID_EXPIRY");
    }

    if (
      request.expires_at.getTime() <=
      context.now.getTime()
    ) {
      return deny("REQUEST_EXPIRED");
    }
  }

  if (
    action === "APPROVE" &&
    context.actor_staff_id ===
      request.requested_by_staff_id
  ) {
    return deny("SELF_APPROVAL_FORBIDDEN");
  }

  if (action === "APPROVE") {
    return {
      allowed: true,
      next_status: "APPROVED"
    };
  }

  if (action === "REJECT") {
    return {
      allowed: true,
      next_status: "REJECTED"
    };
  }

  return deny("INVALID_ACTION");
}
