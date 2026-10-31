import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import type {
  PoolConnection
} from "mysql2/promise";

import {
  hasApprovedLaunchRequest
} from "../src/modules/products/product.approved-configuration-guard.js";

function connectionWithRows(rows: unknown[]) {
  const execute = vi.fn().mockResolvedValue([
    rows,
    []
  ]);

  return {
    connection: {
      execute
    } as unknown as PoolConnection,
    execute
  };
}

describe("Approved configuration guard", () => {
  it("allows changes when no approval exists", async () => {
    const { connection, execute } =
      connectionWithRows([]);

    expect(
      await hasApprovedLaunchRequest(connection, 10)
    ).toBe(false);

    expect(execute).toHaveBeenCalledOnce();

    const [sql, params] = execute.mock.calls[0]!;

    expect(sql).toContain(
      "FROM platform_change_requests"
    );
    expect(sql).toContain(
      "operation_code = 'PRODUCT_LAUNCH'"
    );
    expect(sql).toContain(
      "target_type = 'PRODUCT'"
    );
    expect(sql).toContain(
      "status = 'APPROVED'"
    );
    expect(sql).toContain("FOR UPDATE");
    expect(params).toEqual([10]);
  });

  it("blocks changes after approval", async () => {
    const { connection } = connectionWithRows([
      { id: 50 }
    ]);

    expect(
      await hasApprovedLaunchRequest(connection, 10)
    ).toBe(true);
  });

  it("rejects invalid product identifiers", async () => {
    const { connection, execute } =
      connectionWithRows([]);

    await expect(
      hasApprovedLaunchRequest(connection, 0)
    ).rejects.toThrow("INVALID_PRODUCT_ID");

    expect(execute).not.toHaveBeenCalled();
  });

  it("fails closed when database query fails", async () => {
    const execute = vi.fn().mockRejectedValue(
      new Error("DATABASE_UNAVAILABLE")
    );

    const connection = {
      execute
    } as unknown as PoolConnection;

    await expect(
      hasApprovedLaunchRequest(connection, 10)
    ).rejects.toThrow("DATABASE_UNAVAILABLE");
  });
});
