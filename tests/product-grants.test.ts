import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  getConnection: vi.fn()
}));

vi.mock("../src/database/pool.js", () => ({
  pool: {
    getConnection: mocks.getConnection
  }
}));

import {
  assignProductGrant,
  revokeProductGrant
} from "../src/modules/product-grants/grant.service.js";

const input = {
  product_code: "TEST_PRODUCT",
  staff_public_id: "123e4567-e89b-42d3-a456-426614174000",
  role_code: "PRODUCT_VIEWER" as const
};

describe("Product grant transactions", () => {
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

  it("rejects unknown products", async () => {
    mocks.execute.mockResolvedValueOnce([[], []]);

    await expect(
      assignProductGrant(input, 1)
    ).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
      httpStatus: 404
    });

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("rejects inactive or unknown staff", async () => {
    mocks.execute
      .mockResolvedValueOnce([[{ id: 10 }], []])
      .mockResolvedValueOnce([[], []]);

    await expect(
      assignProductGrant(input, 1)
    ).rejects.toMatchObject({
      code: "ACTIVE_STAFF_NOT_FOUND"
    });

    expect(mocks.rollback).toHaveBeenCalledOnce();
  });

  it("rejects an existing active grant", async () => {
    mocks.execute
      .mockResolvedValueOnce([[{ id: 10 }], []])
      .mockResolvedValueOnce([[{ id: 20 }], []])
      .mockResolvedValueOnce([[
        { id: 30, status: "ACTIVE", version_no: 1 }
      ], []]);

    await expect(
      assignProductGrant(input, 1)
    ).rejects.toMatchObject({
      code: "GRANT_ALREADY_EXISTS"
    });

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("creates a grant and commits audit atomically", async () => {
    mocks.execute
      .mockResolvedValueOnce([[{ id: 10 }], []])
      .mockResolvedValueOnce([[{ id: 20 }], []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([{ insertId: 30 }, []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const result = await assignProductGrant(input, 1);

    expect(result).toEqual({
      grant_id: 30,
      status: "ACTIVE"
    });

    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.rollback).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("rolls back if grant audit insert fails", async () => {
    mocks.execute
      .mockResolvedValueOnce([[{ id: 10 }], []])
      .mockResolvedValueOnce([[{ id: 20 }], []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([{ insertId: 30 }, []])
      .mockRejectedValueOnce(new Error("Audit failed"));

    await expect(
      assignProductGrant(input, 1)
    ).rejects.toThrow("Audit failed");

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("rejects a stale revocation version", async () => {
    mocks.execute.mockResolvedValueOnce([[
      { id: 30, status: "ACTIVE", version_no: 2 }
    ], []]);

    await expect(
      revokeProductGrant(30, 1, 1)
    ).rejects.toMatchObject({
      code: "GRANT_VERSION_CONFLICT"
    });

    expect(mocks.rollback).toHaveBeenCalledOnce();
  });

  it("revokes an active grant with matching version", async () => {
    mocks.execute
      .mockResolvedValueOnce([[
        { id: 30, status: "ACTIVE", version_no: 1 }
      ], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const result = await revokeProductGrant(30, 1, 1);

    expect(result).toEqual({
      grant_id: 30,
      status: "REVOKED",
      version_no: 2
    });

    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.rollback).not.toHaveBeenCalled();
  });

  it("rolls back when revocation audit fails", async () => {
    mocks.execute
      .mockResolvedValueOnce([[
        { id: 30, status: "ACTIVE", version_no: 1 }
      ], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockRejectedValueOnce(new Error("Audit failed"));

    await expect(
      revokeProductGrant(30, 1, 1)
    ).rejects.toThrow("Audit failed");

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
});
