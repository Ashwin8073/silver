import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn()
}));

vi.mock("../src/database/pool.js", () => ({
  pool: {
    query: mocks.query
  }
}));

import {
  grantListSchema,
  listProductGrants
} from "../src/modules/product-grants/grant.list.js";

describe("Grant listing validation", () => {
  it("requires a product code", () => {
    expect(
      grantListSchema.safeParse({}).success
    ).toBe(false);
  });

  it("rejects invalid grant status", () => {
    expect(
      grantListSchema.safeParse({
        product_code: "TEST_PRODUCT",
        status: "EXPIRED"
      }).success
    ).toBe(false);
  });

  it("rejects excessive page sizes", () => {
    expect(
      grantListSchema.safeParse({
        product_code: "TEST_PRODUCT",
        limit: 500
      }).success
    ).toBe(false);
  });

  it("applies safe default pagination", () => {
    const result = grantListSchema.parse({
      product_code: "TEST_PRODUCT"
    });

    expect(result.limit).toBe(20);
    expect(result.cursor).toBe(0);
  });
});

describe("Grant listing repository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns an empty list", async () => {
    mocks.query.mockResolvedValueOnce([[], []]);

    const result = await listProductGrants({
      product_code: "TEST_PRODUCT",
      limit: 20,
      cursor: 0
    });

    expect(result.items).toEqual([]);
    expect(result.next_cursor).toBeNull();
  });

  it("filters product and status using parameters", async () => {
    mocks.query.mockResolvedValueOnce([[], []]);

    await listProductGrants({
      product_code: "TEST_PRODUCT",
      status: "ACTIVE",
      limit: 10,
      cursor: 5
    });

    const [sql, params] = mocks.query.mock.calls[0];

    expect(sql).toContain("p.product_code = ?");
    expect(sql).toContain("spg.status = ?");
    expect(sql).toContain("ORDER BY spg.id ASC");
    expect(params).toEqual([
      "TEST_PRODUCT",
      5,
      "ACTIVE",
      11
    ]);
  });

  it("returns next cursor when more rows exist", async () => {
    mocks.query.mockResolvedValueOnce([
      [
        { id: 10, role_code: "PRODUCT_VIEWER" },
        { id: 11, role_code: "PRODUCT_ADMIN" },
        { id: 12, role_code: "PRODUCT_SUPPORT" }
      ],
      []
    ]);

    const result = await listProductGrants({
      product_code: "TEST_PRODUCT",
      limit: 2,
      cursor: 0
    });

    expect(result.items).toHaveLength(2);
    expect(result.next_cursor).toBe(11);
  });

  it("does not expose staff email in SQL selection", async () => {
    mocks.query.mockResolvedValueOnce([[], []]);

    await listProductGrants({
      product_code: "TEST_PRODUCT",
      limit: 20,
      cursor: 0
    });

    const [sql] = mocks.query.mock.calls[0];

    expect(sql).not.toMatch(/sa\.email/);
    expect(sql).toContain("sa.public_id");
  });
});


describe("Effective grant status SQL", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("calculates expired and revoked grants", async () => {
    mocks.query.mockResolvedValueOnce([[], []]);

    await listProductGrants({
      product_code: "TEST_PRODUCT",
      limit: 20,
      cursor: 0
    });

    const [sql] = mocks.query.mock.calls[0];

    expect(sql).toContain(
      "WHEN spg.status = 'REVOKED'"
    );

    expect(sql).toContain(
      "spg.expires_at <= UTC_TIMESTAMP(6)"
    );

    expect(sql).toContain(
      "END AS effective_status"
    );
  });

  it("returns effective status from repository rows", async () => {
    mocks.query.mockResolvedValueOnce([
      [{
        id: 10,
        status: "ACTIVE",
        effective_status: "EXPIRED",
        role_code: "PRODUCT_VIEWER"
      }],
      []
    ]);

    const result = await listProductGrants({
      product_code: "TEST_PRODUCT",
      limit: 20,
      cursor: 0
    });

    expect(
      result.items[0].effective_status
    ).toBe("EXPIRED");
  });
});
