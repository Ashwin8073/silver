import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn()
}));

vi.mock("../src/database/pool.js", () => ({
  pool: {
    execute: mocks.execute
  }
}));

import {
  getProductLaunchEvidence
} from "../src/modules/products/product.launch.evidence.js";

describe("Product launch evidence", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns actual configuration evidence", async () => {
    const evidence = {
      active_plans: 1,
      current_prices: 2,
      enabled_integrations: 1,
      verified_launch_checks: 3,
      unresolved_launch_checks: 0
    };

    mocks.execute.mockResolvedValueOnce([
      [evidence],
      []
    ]);

    const result = await getProductLaunchEvidence(10);

    expect(result).toEqual(evidence);
  });

  it("scopes every query to the requested product", async () => {
    mocks.execute.mockResolvedValueOnce([
      [{
        active_plans: 0,
        current_prices: 0,
        enabled_integrations: 0,
        verified_launch_checks: 0,
        unresolved_launch_checks: 0
      }],
      []
    ]);

    await getProductLaunchEvidence(25);

    const [sql, params] = mocks.execute.mock.calls[0];

    expect(params).toEqual([25, 25, 25, 25, 25]);
    expect(sql).toContain("UTC_TIMESTAMP(6)");
    expect(sql).toContain("verified_by_staff_id IS NOT NULL");
    expect(sql).toContain("verified_at IS NOT NULL");
  });

  it("fails closed when evidence cannot be retrieved", async () => {
    mocks.execute.mockResolvedValueOnce([[], []]);

    await expect(
      getProductLaunchEvidence(10)
    ).rejects.toThrow("LAUNCH_EVIDENCE_UNAVAILABLE");
  });
});
