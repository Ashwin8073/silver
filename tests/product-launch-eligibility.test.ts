import { describe, expect, it } from "vitest";

import {
  evaluateLaunchEligibility
} from "../src/modules/products/product.launch.eligibility.js";

const completeEvidence = {
  active_plans: 1,
  current_prices: 1,
  enabled_integrations: 1,
  verified_launch_checks: 3,
  unresolved_launch_checks: 0
};

describe("Product launch eligibility", () => {
  it("blocks missing active plans", () => {
    const result = evaluateLaunchEligibility({
      ...completeEvidence,
      active_plans: 0
    });

    expect(result.blockers).toContain("NO_ACTIVE_PLAN");
    expect(result.eligible).toBe(false);
  });

  it("blocks missing current pricing", () => {
    const result = evaluateLaunchEligibility({
      ...completeEvidence,
      current_prices: 0
    });

    expect(result.blockers).toContain("NO_CURRENT_PRICE");
  });

  it("blocks missing enabled integration", () => {
    const result = evaluateLaunchEligibility({
      ...completeEvidence,
      enabled_integrations: 0
    });

    expect(result.blockers).toContain("NO_ENABLED_INTEGRATION");
  });

  it("blocks unresolved launch checks", () => {
    const result = evaluateLaunchEligibility({
      ...completeEvidence,
      unresolved_launch_checks: 2
    });

    expect(result.blockers).toContain("UNRESOLVED_LAUNCH_CHECKS");
  });

  it("blocks missing verified launch checks", () => {
    const result = evaluateLaunchEligibility({
      ...completeEvidence,
      verified_launch_checks: 0
    });

    expect(result.blockers).toContain("NO_VERIFIED_LAUNCH_CHECK");
  });

  it("never approves based on counts alone", () => {
    const result = evaluateLaunchEligibility(
      completeEvidence
    );

    expect(result.status).toBe("BLOCKED");
    expect(result.eligible).toBe(false);
    expect(result.activation_enabled).toBe(false);
    expect(result.blockers).toContain(
      "SUPER_ADMIN_APPROVAL_NOT_VERIFIED"
    );
    expect(result.blockers).toContain(
      "MANDATORY_CHECKLIST_NOT_VALIDATED"
    );
  });

  it("fails closed on invalid evidence", () => {
    const result = evaluateLaunchEligibility({
      ...completeEvidence,
      current_prices: -1
    });

    expect(result.blockers).toContain(
      "INVALID_LAUNCH_EVIDENCE"
    );
    expect(result.activation_enabled).toBe(false);
  });
});
