import {
  hasApprovedLaunchRequest
} from "../src/modules/products/product.approved-configuration-guard.js";
vi.mock(
  "../src/modules/products/product.approved-configuration-guard.js",
  () => ({
    hasApprovedLaunchRequest:
      vi.fn().mockResolvedValue(false)
  })
);
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

const mocks = vi.hoisted(() => {
  const execute = vi.fn();
  const beginTransaction = vi.fn();
  const commit = vi.fn();
  const rollback = vi.fn();
  const release = vi.fn();
  const getConnection = vi.fn();

  return {
    execute,
    beginTransaction,
    commit,
    rollback,
    release,
    getConnection
  };
});

vi.mock("../src/database/pool.js", () => ({
  pool: {
    getConnection: mocks.getConnection
  }
}));

import {
  updateDraftProduct
} from "../src/modules/products/product.update.service.js";

describe("Transactional DRAFT product updates", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(hasApprovedLaunchRequest)
      .mockResolvedValue(false);

    mocks.getConnection.mockResolvedValue({
      execute: mocks.execute,
      beginTransaction: mocks.beginTransaction,
      commit: mocks.commit,
      rollback: mocks.rollback,
      release: mocks.release
    });

    mocks.beginTransaction.mockResolvedValue(undefined);
    mocks.commit.mockResolvedValue(undefined);
    mocks.rollback.mockResolvedValue(undefined);
  });

  it("rolls back when product does not exist", async () => {
    mocks.execute.mockResolvedValueOnce([[], []]);

    const result = await updateDraftProduct(
      "UNKNOWN",
      { product_name: "Updated Product" },
      1,
      ["SUPER_ADMIN"]
    );

    expect(result).toBe("NOT_FOUND");
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("rejects staff without PRODUCT_ADMIN grant", async () => {
    mocks.execute
      .mockResolvedValueOnce([
        [{ id: 10, status: "DRAFT" }],
        []
      ])
      .mockResolvedValueOnce([[], []]);

    const result = await updateDraftProduct(
      "TEST_PRODUCT",
      { product_name: "Updated Product" },
      2,
      []
    );

    expect(result).toBe("FORBIDDEN");
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("rejects updates to ACTIVE products", async () => {
    mocks.execute.mockResolvedValueOnce([
      [{ id: 10, status: "ACTIVE" }],
      []
    ]);

    const result = await updateDraftProduct(
      "TEST_PRODUCT",
      { product_name: "Updated Product" },
      1,
      ["SUPER_ADMIN"]
    );

    expect(result).toBe("NOT_EDITABLE");
    expect(mocks.rollback).toHaveBeenCalledOnce();
  });

  it("commits product update with audit record", async () => {
    mocks.execute
      .mockResolvedValueOnce([
        [{ id: 10, status: "DRAFT" }],
        []
      ])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const result = await updateDraftProduct(
      "TEST_PRODUCT",
      { product_name: "Updated Product" },
      1,
      ["SUPER_ADMIN"]
    );

    expect(result).toBe("UPDATED");
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.rollback).not.toHaveBeenCalled();
    expect(mocks.execute).toHaveBeenCalledTimes(3);
  });

  it("rolls back if audit logging fails", async () => {
    mocks.execute
      .mockResolvedValueOnce([
        [{ id: 10, status: "DRAFT" }],
        []
      ])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockRejectedValueOnce(
        new Error("Audit insert failed")
      );

    await expect(
      updateDraftProduct(
        "TEST_PRODUCT",
        { product_name: "Updated Product" },
        1,
        ["SUPER_ADMIN"]
      )
    ).rejects.toThrow("Audit insert failed");

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("checks PRODUCT_ADMIN grant using transaction connection", async () => {
    mocks.execute
      .mockResolvedValueOnce([
        [{ id: 10, status: "DRAFT" }],
        []
      ])
      .mockResolvedValueOnce([
        [{ role_code: "PRODUCT_ADMIN" }],
        []
      ])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const result = await updateDraftProduct(
      "TEST_PRODUCT",
      { product_name: "Updated Product" },
      2,
      []
    );

    expect(result).toBe("UPDATED");

    const grantCall = mocks.execute.mock.calls[1];

    expect(grantCall[0]).toContain(
      "role_code = 'PRODUCT_ADMIN'"
    );

    expect(grantCall[0]).toContain(
      "revoked_at IS NULL"
    );

    expect(grantCall[0]).toContain(
      "expires_at > UTC_TIMESTAMP(6)"
    );

    expect(grantCall[0]).toContain("FOR UPDATE");
    expect(grantCall[1]).toEqual([2, 10]);
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
  it("blocks product edits after launch approval", async () => {
    mocks.execute.mockResolvedValueOnce([
      [{ id: 10, status: "DRAFT" }],
      []
    ]);

    vi.mocked(hasApprovedLaunchRequest)
      .mockResolvedValue(true);

    const result = await updateDraftProduct(
      "TEST_PRODUCT",
      { product_name: "Changed After Approval" },
      1,
      ["SUPER_ADMIN"]
    );

    expect(result).toBe("NOT_EDITABLE");

    expect(hasApprovedLaunchRequest)
      .toHaveBeenCalledOnce();

    expect(mocks.execute).toHaveBeenCalledTimes(1);

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });
});
