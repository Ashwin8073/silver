import "dotenv/config";

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

import request from "supertest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn()
}));

vi.mock("../src/database/pool.js", () => ({
  pool: {
    execute: mocks.execute,
    query: vi.fn()
  }
}));

import {
  getProductLaunchOverview
} from "../src/modules/products/product.launch.service.js";

import { app } from "../src/app.js";

describe("Product launch overview service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns configuration counts", async () => {
    const overview = {
      plans: 2,
      prices: 3,
      integrations: 1,
      launch_checks: 4,
      trial_policies: 1
    };

    mocks.execute.mockResolvedValueOnce([
      [overview],
      []
    ]);

    const result = await getProductLaunchOverview(10);

    expect(result).toEqual(overview);
    expect(mocks.execute).toHaveBeenCalledOnce();
  });

  it("scopes every configuration count to the product", async () => {
    mocks.execute.mockResolvedValueOnce([
      [{
        plans: 0,
        prices: 0,
        integrations: 0,
        launch_checks: 0,
        trial_policies: 0
      }],
      []
    ]);

    await getProductLaunchOverview(25);

    const [sql, params] = mocks.execute.mock.calls[0];

    expect(params).toEqual([25, 25, 25, 25, 25]);
    expect(sql).toContain("FROM product_launch_checks");
    expect(sql).toContain("FROM product_integrations");
    expect(sql).toContain("FROM trial_policies");
    expect(sql).toContain("FROM plan_prices");
    expect(sql).toContain("FROM plans");
  });

  it("propagates database errors without writing data", async () => {
    mocks.execute.mockRejectedValueOnce(
      new Error("Database query failed")
    );

    await expect(
      getProductLaunchOverview(10)
    ).rejects.toThrow("Database query failed");

    expect(mocks.execute).toHaveBeenCalledOnce();

    const [sql] = mocks.execute.mock.calls[0];

    expect(sql.trim().toUpperCase().startsWith("SELECT")).toBe(true);
  });
});

describe("Product launch overview authentication", () => {
  it("rejects anonymous launch overview requests", async () => {
    const response = await request(app)
      .get("/api/v1/staff/products/TEST_PRODUCT/launch-overview");

    expect(response.status).toBe(401);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
