import { describe, expect, it } from "vitest";

import {
  evaluateProductReadiness
} from "../src/modules/products/product.readiness.js";

describe("Product launch readiness", () => {
  it("blocks completely unconfigured products", () => {
    const result = evaluateProductReadiness({
      plans: 0,
      prices: 0,
      integrations: 0,
      launch_checks: 0,
      trial_policies: 0
    });

    expect(result.status).toBe("MISSING_CONFIGURATION");
    expect(result.activation_enabled).toBe(false);
    expect(result.missing_requirements).toHaveLength(4);
  });

  it("reports missing pricing", () => {
    const result = evaluateProductReadiness({
      plans: 1,
      prices: 0,
      integrations: 1,
      launch_checks: 1,
      trial_policies: 0
    });

    expect(result.missing_requirements).toEqual(["PRICING"]);
  });

  it("requires manual review even when counts are present", () => {
    const result = evaluateProductReadiness({
      plans: 2,
      prices: 2,
      integrations: 1,
      launch_checks: 4,
      trial_policies: 1
    });

    expect(result.status).toBe("REVIEW_REQUIRED");
    expect(result.activation_enabled).toBe(false);
    expect(result.missing_requirements).toEqual([]);
  });

  it("does not require a trial policy", () => {
    const result = evaluateProductReadiness({
      plans: 1,
      prices: 1,
      integrations: 1,
      launch_checks: 1,
      trial_policies: 0
    });

    expect(result.missing_requirements).not.toContain("TRIAL_POLICY");
    expect(result.activation_enabled).toBe(false);
  });
});
