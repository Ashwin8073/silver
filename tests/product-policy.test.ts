import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

vi.mock("../src/database/pool.js", () => ({
  pool: {
    execute: vi.fn()
  }
}));

import { pool } from "../src/database/pool.js";

import {
  canManageProduct,
  canReadProduct,
  getActiveProductGrants,
  hasGlobalProductReadAccess,
  hasGlobalProductWriteAccess
} from "../src/modules/products/product.policy.js";

const executeMock = vi.mocked(pool.execute);

function mockGrants(roles: string[]) {
  executeMock.mockResolvedValueOnce([
    roles.map(role_code => ({ role_code })),
    []
  ] as never);
}

describe("Product-level RBAC", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("allows SUPER_ADMIN global read", () => {
    expect(
      hasGlobalProductReadAccess(["SUPER_ADMIN"])
    ).toBe(true);
  });

  it("allows AUDITOR global read", () => {
    expect(
      hasGlobalProductReadAccess(["AUDITOR"])
    ).toBe(true);
  });

  it("does not allow AUDITOR global write", () => {
    expect(
      hasGlobalProductWriteAccess(["AUDITOR"])
    ).toBe(false);
  });

  it("allows SUPER_ADMIN global write", () => {
    expect(
      hasGlobalProductWriteAccess(["SUPER_ADMIN"])
    ).toBe(true);
  });

  it("allows SUPER_ADMIN without querying grants", async () => {
    const allowed = await canManageProduct(
      1,
      ["SUPER_ADMIN"],
      10
    );

    expect(allowed).toBe(true);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("allows PRODUCT_ADMIN to manage assigned product", async () => {
    mockGrants(["PRODUCT_ADMIN"]);

    expect(
      await canManageProduct(2, [], 10)
    ).toBe(true);
  });

  it("prevents PRODUCT_VIEWER from editing", async () => {
    mockGrants(["PRODUCT_VIEWER"]);

    expect(
      await canManageProduct(2, [], 10)
    ).toBe(false);
  });

  it("prevents PRODUCT_BILLING from editing", async () => {
    mockGrants(["PRODUCT_BILLING"]);

    expect(
      await canManageProduct(2, [], 10)
    ).toBe(false);
  });

  it("prevents unassigned staff from editing", async () => {
    mockGrants([]);

    expect(
      await canManageProduct(2, [], 10)
    ).toBe(false);
  });

  it("allows assigned staff to read product", async () => {
    mockGrants(["PRODUCT_VIEWER"]);

    expect(
      await canReadProduct(2, [], 10)
    ).toBe(true);
  });

  it("denies unassigned staff product read", async () => {
    mockGrants([]);

    expect(
      await canReadProduct(2, [], 10)
    ).toBe(false);
  });

  it("filters revoked and expired grants in SQL", async () => {
    mockGrants([]);

    await getActiveProductGrants(2, 10);

    expect(executeMock).toHaveBeenCalledOnce();

    const [sql, params] = executeMock.mock.calls[0];

    expect(sql).toContain("status = 'ACTIVE'");
    expect(sql).toContain("revoked_at IS NULL");
    expect(sql).toContain("expires_at > UTC_TIMESTAMP(6)");
    expect(params).toEqual([2, 10]);
  });
});
