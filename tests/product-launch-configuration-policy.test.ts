import {
  describe,
  expect,
  it
} from "vitest";

import {
  assessLaunchConfiguration
} from "../src/modules/products/product.launch.configuration-policy.js";

import {
  MANDATORY_LAUNCH_CHECKS
} from "../src/modules/products/product.launch.checklist.js";

import type {
  LaunchConfigurationSnapshot
} from "../src/modules/products/product.launch.snapshot.js";

const now = new Date("2026-10-31T13:00:00Z");

function validSnapshot(): LaunchConfigurationSnapshot {
  return {
    product: {
      product_code: "TEST_PRODUCT",
      product_name: "Test Product",
      status: "DRAFT",
      provisioning_mode: "API",
      application_url: "https://example.com",
      onboarding_url: null
    },
    plans: [{
      plan_code: "BASIC",
      plan_name: "Basic",
      status: "ACTIVE",
      tier_rank: 1,
      prices: [{
        currency: "INR",
        billing_interval: "MONTHLY",
        amount_minor: 99900,
        version_no: 1,
        valid_from: "2026-10-01T00:00:00.000000Z",
        valid_until: null
      }]
    }],
    integrations: [{
      integration_code: "TEST_API",
      api_audience: "test-audience",
      status: "ENABLED",
      secret_reference: null
    }],
    trial_policy: {
      enabled: false,
      trial_days: 0
    },
    launch_checks: MANDATORY_LAUNCH_CHECKS.map(
      code => ({
        check_code: code,
        status: "PASSED",
        verified_by_staff_id: 2,
        verified_at: "2026-10-31T10:00:00.000000Z",
        details_json: null
      })
    )
  };
}

describe("Launch configuration readiness", () => {
  it("accepts configured evidence without allowing approval", () => {
    const result = assessLaunchConfiguration(
      validSnapshot(),
      now
    );

    expect(result.configuration_checks_passed).toBe(true);
    expect(result.approval_eligible).toBe(false);
    expect(result.activation_enabled).toBe(false);
    expect(result.blockers).toEqual([]);
  });

  it("blocks missing active plans", () => {
    const snapshot = validSnapshot();
    snapshot.plans[0]!.status = "DRAFT";

    expect(
      assessLaunchConfiguration(snapshot, now).blockers
    ).toContain("NO_ACTIVE_PLAN");
  });

  it("blocks expired pricing", () => {
    const snapshot = validSnapshot();
    snapshot.plans[0]!.prices[0]!.valid_until =
      "2026-10-15T00:00:00.000000Z";

    expect(
      assessLaunchConfiguration(snapshot, now).blockers
    ).toContain("NO_VALID_CURRENT_PRICE");
  });

  it("blocks missing enabled integration", () => {
    const snapshot = validSnapshot();
    snapshot.integrations[0]!.status = "DISABLED";

    expect(
      assessLaunchConfiguration(snapshot, now).blockers
    ).toContain("NO_ENABLED_INTEGRATION");
  });

  it("blocks missing mandatory verification", () => {
    const snapshot = validSnapshot();
    snapshot.launch_checks.pop();

    const result = assessLaunchConfiguration(snapshot, now);

    expect(result.configuration_checks_passed).toBe(false);
    expect(result.blockers.some(
      blocker => blocker.startsWith(
        "MANDATORY_CHECK_MISSING_OR_DUPLICATE"
      )
    )).toBe(true);
  });

  it("blocks unverified checklist entries", () => {
    const snapshot = validSnapshot();
    snapshot.launch_checks[0]!.status = "PENDING";

    expect(
      assessLaunchConfiguration(snapshot, now).blockers
    ).toContain("UNRESOLVED_LAUNCH_CHECKS");
  });

  it("blocks inconsistent trial policy", () => {
    const snapshot = validSnapshot();
    snapshot.trial_policy = {
      enabled: true,
      trial_days: 0
    };

    expect(
      assessLaunchConfiguration(snapshot, now).blockers
    ).toContain("INVALID_TRIAL_POLICY");
  });

  it("fails closed on invalid assessment time", () => {
    const result = assessLaunchConfiguration(
      validSnapshot(),
      new Date("invalid")
    );

    expect(result.configuration_checks_passed).toBe(false);
    expect(result.approval_eligible).toBe(false);
    expect(result.activation_enabled).toBe(false);
  });
});
