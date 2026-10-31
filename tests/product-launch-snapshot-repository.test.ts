import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

import type { PoolConnection } from "mysql2/promise";

import {
  readLaunchConfigurationSnapshot,
  readLaunchConfigurationHash
} from "../src/modules/products/product.launch.snapshot.repository.js";

const mocks = vi.hoisted(() => ({
  execute: vi.fn()
}));

const connection = {
  execute: mocks.execute
} as unknown as PoolConnection;

const product = {
  product_code: "TEST_PRODUCT",
  product_name: "Test Product",
  status: "DRAFT",
  provisioning_mode: "API",
  application_url: "https://example.com",
  onboarding_url: null
};

const plan = {
  id: 10,
  plan_code: "BASIC",
  plan_name: "Basic",
  status: "ACTIVE",
  tier_rank: 1
};

const price = {
  plan_id: 10,
  currency: "INR",
  billing_interval: "MONTHLY",
  amount_minor: "99900",
  version_no: 1,
  valid_from: "2026-10-31T00:00:00.000000Z",
  valid_until: null
};

function mockSnapshot(
  options: {
    products?: unknown[];
    plans?: unknown[];
    prices?: unknown[];
    integrations?: unknown[];
    policies?: unknown[];
    checks?: unknown[];
  } = {}
) {
  const results = [
    options.products ?? [product],
    options.plans ?? [plan],
    options.prices ?? [price],
    options.integrations ?? [{
      integration_code: "TEST_API",
      api_audience: "test-audience",
      status: "ENABLED",
      secret_reference: null
    }],
    options.policies ?? [{
      enabled: 0,
      trial_days: 0
    }],
    options.checks ?? [{
      check_code: "SECURITY_REVIEW",
      status: "PASSED",
      verified_by_staff_id: 2,
      verified_at: "2026-10-31T10:00:00.000000Z",
      details_json: null
    }]
  ];

  for (const rows of results) {
    mocks.execute.mockResolvedValueOnce([rows, []]);
  }
}

describe("MySQL launch configuration snapshot reader", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("reads all six configuration sources", async () => {
    mockSnapshot();

    const snapshot = await readLaunchConfigurationSnapshot(
      connection,
      25
    );

    expect(mocks.execute).toHaveBeenCalledTimes(6);
    expect(snapshot.product.product_code).toBe("TEST_PRODUCT");
    expect(snapshot.plans[0]?.prices[0]?.amount_minor)
      .toBe(99900);
    expect(snapshot.integrations).toHaveLength(1);
    expect(snapshot.trial_policy?.enabled).toBe(false);
    expect(snapshot.launch_checks).toHaveLength(1);
  });

  it("scopes all queries to the same product", async () => {
    mockSnapshot();

    await readLaunchConfigurationSnapshot(connection, 25);

    for (const [, params] of mocks.execute.mock.calls) {
      expect(params).toEqual([25]);
    }
  });

  it("generates a deterministic SHA-256 hash", async () => {
    mockSnapshot();

    const first = await readLaunchConfigurationHash(
      connection,
      25
    );

    mockSnapshot();

    const second = await readLaunchConfigurationHash(
      connection,
      25
    );

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(second);
  });

  it("detects changed pricing", async () => {
    mockSnapshot();

    const first = await readLaunchConfigurationHash(
      connection,
      25
    );

    mockSnapshot({
      prices: [{
        ...price,
        amount_minor: "199900"
      }]
    });

    const second = await readLaunchConfigurationHash(
      connection,
      25
    );

    expect(first).not.toBe(second);
  });

  it("rejects missing products", async () => {
    mockSnapshot({ products: [] });

    await expect(
      readLaunchConfigurationSnapshot(connection, 25)
    ).rejects.toThrow("SNAPSHOT_PRODUCT_NOT_FOUND");
  });

  it("rejects invalid numeric values", async () => {
    mockSnapshot({
      prices: [{
        ...price,
        amount_minor: "9007199254740993"
      }]
    });

    await expect(
      readLaunchConfigurationSnapshot(connection, 25)
    ).rejects.toThrow("INVALID_SNAPSHOT_NUMBER");
  });

  it("rejects invalid product identifiers", async () => {
    await expect(
      readLaunchConfigurationSnapshot(connection, -1)
    ).rejects.toThrow("INVALID_PRODUCT_ID");

    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
