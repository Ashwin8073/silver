import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConnection: vi.fn(),
  execute: vi.fn(),
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  getProduct: vi.fn()
}));

vi.mock("../src/database/pool.js", () => ({
  pool: {
    getConnection: mocks.getConnection
  }
}));

vi.mock("../src/modules/products/product.repository.js", () => ({
  getProduct: mocks.getProduct
}));

import {
  createProduct,
  ProductConflictError
} from "../src/modules/products/product.service.js";

const input = {
  product_code: "INTEGRATION_TEST",
  product_name: "Integration Test Product",
  provisioning_mode: "API" as const
};

describe("Product creation transaction", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.getConnection.mockResolvedValue({
      execute: mocks.execute,
      beginTransaction: mocks.beginTransaction,
      commit: mocks.commit,
      rollback: mocks.rollback,
      release: mocks.release
    });
  });

  it("commits product creation and audit atomically", async () => {
    mocks.execute
      .mockResolvedValueOnce([{ insertId: 101, affectedRows: 1 }, []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    mocks.getProduct.mockResolvedValue({
      id: 101,
      product_code: input.product_code
    });

    const result = await createProduct(input, 1);

    expect(mocks.beginTransaction).toHaveBeenCalledOnce();
    expect(mocks.execute).toHaveBeenCalledTimes(2);
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.rollback).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
    expect(result.product_code).toBe(input.product_code);
  });

  it("rolls back duplicate product code", async () => {
    mocks.execute.mockRejectedValueOnce({
      code: "ER_DUP_ENTRY"
    });

    await expect(
      createProduct(input, 1)
    ).rejects.toBeInstanceOf(ProductConflictError);

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("rolls back when audit insert fails", async () => {
    mocks.execute
      .mockResolvedValueOnce([{ insertId: 101, affectedRows: 1 }, []])
      .mockRejectedValueOnce(new Error("Audit insert failed"));

    await expect(
      createProduct(input, 1)
    ).rejects.toThrow("Audit insert failed");

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.getProduct).not.toHaveBeenCalled();
  });

  it("does not roll back committed creation when read fails", async () => {
    mocks.execute
      .mockResolvedValueOnce([{ insertId: 101, affectedRows: 1 }, []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    mocks.getProduct.mockRejectedValue(
      new Error("Post-commit read failed")
    );

    await expect(
      createProduct(input, 1)
    ).rejects.toThrow("Post-commit read failed");

    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.rollback).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });
});

describe("Product creation failure handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.getConnection.mockResolvedValue({
      execute: mocks.execute,
      beginTransaction: mocks.beginTransaction,
      commit: mocks.commit,
      rollback: mocks.rollback,
      release: mocks.release
    });
  });

  it("rolls back when commit fails", async () => {
    mocks.execute
      .mockResolvedValueOnce([{ insertId: 1, affectedRows: 1 }, []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    mocks.commit.mockRejectedValueOnce(
      new Error("Commit failed")
    );

    await expect(
      createProduct(input, 1)
    ).rejects.toThrow("Commit failed");

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("releases connection when transaction start fails", async () => {
    mocks.beginTransaction.mockRejectedValueOnce(
      new Error("Transaction failed")
    );

    await expect(
      createProduct(input, 1)
    ).rejects.toThrow("Transaction failed");

    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("rejects simultaneous duplicate inserts using database error", async () => {
    mocks.execute.mockRejectedValueOnce({
      code: "ER_DUP_ENTRY"
    });

    await expect(
      createProduct(input, 1)
    ).rejects.toBeInstanceOf(ProductConflictError);

    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledOnce();
  });
});
