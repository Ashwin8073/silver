import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

const mocks = vi.hoisted(() => ({
  getConnection: vi.fn(),
  query: vi.fn(),
  execute: vi.fn(),
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  verifyAuthority: vi.fn()
}));

vi.mock("../src/database/pool.js", () => ({
  pool: {
    getConnection: mocks.getConnection
  }
}));

vi.mock(
  "../src/modules/products/product.launch.approval-authority.js",
  () => ({
    verifyLaunchApproverAuthority:
      mocks.verifyAuthority
  })
);

import {
  ConfigurationValidationError,
  createDraftPlan,
  createDraftPlanPrice
} from "../src/modules/products/product.configuration-pricing.service.js";

const planInput = {
  product_code: "TEST_PRODUCT",
  plan_code: "SILVER",
  plan_name: "Silver",
  tier_rank: 1
};

const priceInput = {
  product_code: "TEST_PRODUCT",
  plan_code: "SILVER",
  currency: "INR",
  billing_interval: "MONTHLY" as const,
  amount_minor: 99900,
  version_no: 1,
  valid_from: "2026-11-01T00:00:00.000000Z",
  valid_until: null
};

function setup() {
  mocks.getConnection.mockResolvedValue({
    query: mocks.query,
    execute: mocks.execute,
    beginTransaction: mocks.beginTransaction,
    commit: mocks.commit,
    rollback: mocks.rollback,
    release: mocks.release
  });

  mocks.query.mockResolvedValue([[], []]);
  mocks.verifyAuthority.mockResolvedValue(true);
  mocks.beginTransaction.mockResolvedValue(undefined);
  mocks.commit.mockResolvedValue(undefined);
  mocks.rollback.mockResolvedValue(undefined);
  mocks.execute.mockResolvedValue([[], []]);
}

describe("Draft product plans and pricing", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setup();
  });

  it("creates a draft plan with audit in one transaction", async () => {
    mocks.execute
      .mockResolvedValueOnce([
        [{ id: 10, status: "DRAFT" }],
        []
      ])
      .mockResolvedValueOnce([
        { insertId: 21 },
        []
      ])
      .mockResolvedValueOnce([{}, []]);

    const result = await createDraftPlan(
      planInput,
      2
    );

    expect(result).toEqual({
      status: "CREATED",
      id: 21
    });

    expect(mocks.verifyAuthority).toHaveBeenCalledOnce();
    expect(mocks.commit).toHaveBeenCalledOnce();

    const [lockSql] = mocks.execute.mock.calls[0]!;
    const [insertSql] = mocks.execute.mock.calls[1]!;
    const [auditSql] = mocks.execute.mock.calls[2]!;

    expect(lockSql).toContain("FOR UPDATE");
    expect(insertSql).toContain("INSERT INTO plans");
    expect(auditSql).toContain("INSERT INTO audit_logs");
  });

  it("denies plan creation without live authority", async () => {
    mocks.verifyAuthority.mockResolvedValue(false);

    mocks.execute.mockResolvedValueOnce([
      [{ id: 10, status: "DRAFT" }],
      []
    ]);

    const result = await createDraftPlan(
      planInput,
      2
    );

    expect(result.status).toBe("STAFF_FORBIDDEN");
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledOnce();
  });

  it("refuses configuration on non-draft products", async () => {
    mocks.execute.mockResolvedValueOnce([
      [{ id: 10, status: "ACTIVE" }],
      []
    ]);

    const result = await createDraftPlan(
      planInput,
      2
    );

    expect(result.status).toBe("PRODUCT_NOT_EDITABLE");
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledOnce();
  });

  it("creates a versioned price and audit entry", async () => {
    mocks.execute
      .mockResolvedValueOnce([
        [{ id: 10, status: "DRAFT" }],
        []
      ])
      .mockResolvedValueOnce([
        [{ id: 21, status: "DRAFT" }],
        []
      ])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([
        { insertId: 31 },
        []
      ])
      .mockResolvedValueOnce([{}, []]);

    const result = await createDraftPlanPrice(
      priceInput,
      2
    );

    expect(result).toEqual({
      status: "CREATED",
      id: 31
    });

    const [productSql] = mocks.execute.mock.calls[0]!;
    const [planSql] = mocks.execute.mock.calls[1]!;
    const [overlapSql] = mocks.execute.mock.calls[2]!;
    const [insertSql] = mocks.execute.mock.calls[3]!;
    const [auditSql] = mocks.execute.mock.calls[4]!;

    expect(productSql).toContain("FOR UPDATE");
    expect(planSql).toContain("FOR UPDATE");
    expect(overlapSql).toContain("FOR UPDATE");
    expect(insertSql).toContain("INSERT INTO plan_prices");
    expect(auditSql).toContain("INSERT INTO audit_logs");

    expect(mocks.commit).toHaveBeenCalledOnce();
  });

  it("rejects overlapping prices without inserting", async () => {
    mocks.execute
      .mockResolvedValueOnce([
        [{ id: 10, status: "DRAFT" }],
        []
      ])
      .mockResolvedValueOnce([
        [{ id: 21, status: "DRAFT" }],
        []
      ])
      .mockResolvedValueOnce([
        [{ id: 30 }],
        []
      ]);

    const result = await createDraftPlanPrice(
      priceInput,
      2
    );

    expect(result.status).toBe("PRICE_PERIOD_CONFLICT");
    expect(mocks.execute).toHaveBeenCalledTimes(3);
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("rejects invalid price periods before connecting", async () => {
    await expect(
      createDraftPlanPrice(
        {
          ...priceInput,
          valid_until: "2026-10-01T00:00:00.000000Z"
        },
        2
      )
    ).rejects.toBeInstanceOf(
      ConfigurationValidationError
    );

    expect(mocks.getConnection).not.toHaveBeenCalled();
  });

  it("rejects unsafe monetary values before connecting", async () => {
    await expect(
      createDraftPlanPrice(
        {
          ...priceInput,
          amount_minor: Number.MAX_SAFE_INTEGER + 1
        },
        2
      )
    ).rejects.toBeInstanceOf(
      ConfigurationValidationError
    );

    expect(mocks.getConnection).not.toHaveBeenCalled();
  });

  it("rolls back if audit insertion fails", async () => {
    mocks.execute
      .mockResolvedValueOnce([
        [{ id: 10, status: "DRAFT" }],
        []
      ])
      .mockResolvedValueOnce([
        { insertId: 21 },
        []
      ])
      .mockRejectedValueOnce(
        new Error("AUDIT_INSERT_FAILED")
      );

    await expect(
      createDraftPlan(planInput, 2)
    ).rejects.toThrow("AUDIT_INSERT_FAILED");

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });
});
