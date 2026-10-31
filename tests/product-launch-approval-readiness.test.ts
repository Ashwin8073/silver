import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

import type { PoolConnection } from "mysql2/promise";

const mocks = vi.hoisted(() => ({
  readSnapshot: vi.fn()
}));

vi.mock(
  "../src/modules/products/product.launch.snapshot.repository.js",
  () => ({
    readLaunchConfigurationSnapshot: mocks.readSnapshot
  })
);

import {
  readAssessedLaunchConfiguration
} from "../src/modules/products/product.launch.approval-readiness.js";

import {
  hashLaunchConfiguration
} from "../src/modules/products/product.launch.snapshot.js";

import {
  MANDATORY_LAUNCH_CHECKS
} from "../src/modules/products/product.launch.checklist.js";

import type {
  LaunchConfigurationSnapshot
} from "../src/modules/products/product.launch.snapshot.js";

const connection = {} as PoolConnection;
const now = new Date("2026-10-31T13:00:00Z");

function snapshot(): LaunchConfigurationSnapshot {
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
    trial_policy: null,
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

describe("Launch snapshot and readiness assessment", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("reads configuration only once", async () => {
    mocks.readSnapshot.mockResolvedValue(snapshot());

    const result = await readAssessedLaunchConfiguration(
      connection,
      25,
      now
    );

    expect(mocks.readSnapshot).toHaveBeenCalledOnce();

    expect(mocks.readSnapshot).toHaveBeenCalledWith(
      connection,
      25
    );

    expect(result.assessment.configuration_checks_passed)
      .toBe(true);
  });

  it("hashes exactly the configuration being assessed", async () => {
    const current = snapshot();

    mocks.readSnapshot.mockResolvedValue(current);

    const result = await readAssessedLaunchConfiguration(
      connection,
      25,
      now
    );

    expect(result.hash).toBe(
      hashLaunchConfiguration(current)
    );

    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("detects incomplete configuration", async () => {
    const current = snapshot();
    current.plans[0]!.status = "DRAFT";

    mocks.readSnapshot.mockResolvedValue(current);

    const result = await readAssessedLaunchConfiguration(
      connection,
      25,
      now
    );

    expect(result.assessment.configuration_checks_passed)
      .toBe(false);

    expect(result.assessment.blockers)
      .toContain("NO_ACTIVE_PLAN");

    expect(result.assessment.activation_enabled)
      .toBe(false);
  });
});
