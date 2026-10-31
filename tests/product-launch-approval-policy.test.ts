import {
  describe,
  expect,
  it
} from "vitest";

import {
  evaluateLaunchApprovalAction
} from "../src/modules/products/product.launch.approval-policy.js";

import type {
  LaunchApprovalRequest,
  LaunchApprovalContext
} from "../src/modules/products/product.launch.approval-policy.js";

const request: LaunchApprovalRequest = {
  id: 10,
  product_id: 25,
  operation_code: "PRODUCT_LAUNCH",
  target_type: "PRODUCT",
  status: "PENDING",
  requested_by_staff_id: 1,
  expires_at: new Date("2026-12-31T00:00:00Z")
};

const context: LaunchApprovalContext = {
  actor_staff_id: 2,
  actor_roles: ["SUPER_ADMIN"],
  product_id: 25,
  product_status: "DRAFT",
  now: new Date("2026-10-31T00:00:00Z")
};

describe("Product launch approval policy", () => {
  it("permits another Super Admin to approve", () => {
    expect(
      evaluateLaunchApprovalAction(
        request,
        context,
        "APPROVE"
      )
    ).toEqual({
      allowed: true,
      next_status: "APPROVED"
    });
  });

  it("rejects self approval", () => {
    const result = evaluateLaunchApprovalAction(
      request,
      { ...context, actor_staff_id: 1 },
      "APPROVE"
    );

    expect(result).toEqual({
      allowed: false,
      reason: "SELF_APPROVAL_FORBIDDEN"
    });
  });

  it("rejects users without Super Admin role", () => {
    const result = evaluateLaunchApprovalAction(
      request,
      { ...context, actor_roles: ["PRODUCT_ADMIN"] },
      "APPROVE"
    );

    expect(result.allowed).toBe(false);
  });

  it("rejects requests that are no longer pending", () => {
    const result = evaluateLaunchApprovalAction(
      { ...request, status: "APPROVED" },
      context,
      "APPROVE"
    );

    expect(result).toEqual({
      allowed: false,
      reason: "REQUEST_NOT_PENDING"
    });
  });

  it("rejects an expired approval request", () => {
    const result = evaluateLaunchApprovalAction(
      {
        ...request,
        expires_at: new Date("2026-10-01T00:00:00Z")
      },
      context,
      "APPROVE"
    );

    expect(result).toEqual({
      allowed: false,
      reason: "REQUEST_EXPIRED"
    });
  });

  it("rejects approval for another product", () => {
    const result = evaluateLaunchApprovalAction(
      request,
      { ...context, product_id: 99 },
      "APPROVE"
    );

    expect(result).toEqual({
      allowed: false,
      reason: "INVALID_LAUNCH_REQUEST"
    });
  });

  it("rejects launch approval for an active product", () => {
    const result = evaluateLaunchApprovalAction(
      request,
      { ...context, product_status: "ACTIVE" },
      "APPROVE"
    );

    expect(result).toEqual({
      allowed: false,
      reason: "PRODUCT_NOT_DRAFT"
    });
  });

  it("supports rejection without activating a product", () => {
    const result = evaluateLaunchApprovalAction(
      request,
      context,
      "REJECT"
    );

    expect(result).toEqual({
      allowed: true,
      next_status: "REJECTED"
    });
  });
});
