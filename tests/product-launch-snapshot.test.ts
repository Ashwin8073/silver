import { describe, expect, it } from "vitest";

import {
  canonicalLaunchConfiguration,
  hashLaunchConfiguration,
  isLaunchConfigurationCurrent
} from "../src/modules/products/product.launch.snapshot.js";

import type {
  LaunchConfigurationSnapshot
} from "../src/modules/products/product.launch.snapshot.js";

const original: LaunchConfigurationSnapshot = {
  product: {
    product_code: "TEST_PRODUCT",
    product_name: "Test Product",
    status: "DRAFT",
    provisioning_mode: "API",
    application_url: "https://example.com",
    onboarding_url: null
  },
  plans: [
    {
      plan_code: "BASIC",
      plan_name: "Basic",
      status: "ACTIVE",
      tier_rank: 1,
      prices: [
        {
          currency: "INR",
          billing_interval: "MONTHLY",
          amount_minor: 99900,
          version_no: 1,
          valid_from: "2026-10-31T00:00:00.000Z",
          valid_until: null
        }
      ]
    }
  ],
  integrations: [
    {
      integration_code: "TEST_API",
      api_audience: "test-audience",
      status: "ENABLED",
      secret_reference: null
    }
  ],
  trial_policy: {
    enabled: false,
    trial_days: 0
  },
  launch_checks: [
    {
      check_code: "PRODUCT_CONFIG",
      status: "PASSED",
      verified_by_staff_id: 2,
      verified_at: "2026-10-31T10:00:00.000Z",
      details_json: null
    }
  ]
};

function clone(): LaunchConfigurationSnapshot {
  return JSON.parse(JSON.stringify(original));
}

describe("Product launch configuration snapshot", () => {
  it("generates a SHA-256 configuration fingerprint", () => {
    expect(hashLaunchConfiguration(clone()))
      .toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces identical fingerprints for identical data", () => {
    expect(hashLaunchConfiguration(clone()))
      .toBe(hashLaunchConfiguration(clone()));
  });

  it("ignores database record ordering", () => {
    const first = clone();
    const second = clone();

    first.integrations.push({
      ...first.integrations[0]!,
      integration_code: "SECOND_API"
    });

    second.integrations = [...first.integrations].reverse();

    expect(hashLaunchConfiguration(first))
      .toBe(hashLaunchConfiguration(second));
  });

  it("detects product configuration changes", () => {
    const changed = clone();
    changed.product.product_name = "Changed Product";

    expect(hashLaunchConfiguration(changed))
      .not.toBe(hashLaunchConfiguration(clone()));
  });

  it("detects pricing changes", () => {
    const changed = clone();
    changed.plans[0]!.prices[0]!.amount_minor = 199900;

    expect(hashLaunchConfiguration(changed))
      .not.toBe(hashLaunchConfiguration(clone()));
  });

  it("detects changed launch verification", () => {
    const changed = clone();
    changed.launch_checks[0]!.status = "PENDING";

    expect(hashLaunchConfiguration(changed))
      .not.toBe(hashLaunchConfiguration(clone()));
  });

  it("rejects outdated fingerprints", () => {
    const expected = hashLaunchConfiguration(clone());

    const changed = clone();
    changed.integrations[0]!.status = "DISABLED";

    expect(
      isLaunchConfigurationCurrent(changed, expected)
    ).toBe(false);

    expect(
      isLaunchConfigurationCurrent(clone(), expected)
    ).toBe(true);
  });

  it("includes the snapshot schema version", () => {
    const parsed = JSON.parse(
      canonicalLaunchConfiguration(clone())
    );

    expect(parsed.schema_version).toBe(1);
  });
});
