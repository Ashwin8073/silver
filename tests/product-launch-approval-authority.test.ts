import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

import type { PoolConnection } from "mysql2/promise";

import {
  verifyLaunchApproverAuthority
} from "../src/modules/products/product.launch.approval-authority.js";

const mocks = vi.hoisted(() => ({
  execute: vi.fn()
}));

const connection = {
  execute: mocks.execute
} as unknown as PoolConnection;

describe("Launch approver database authorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("accepts a database-verified active Super Admin", async () => {
    mocks.execute.mockResolvedValueOnce([
      [{ id: 2 }],
      []
    ]);

    const result = await verifyLaunchApproverAuthority(
      connection,
      2
    );

    expect(result).toBe(true);

    const [sql, params] = mocks.execute.mock.calls[0]!;

    expect(sql).toContain("FROM staff_accounts");
    expect(sql).toContain("staff_role_assignments");
    expect(sql).toContain("staff_roles");
    expect(sql).toContain("sa.status = 'ACTIVE'");
    expect(sql).toContain("sr.role_code = 'SUPER_ADMIN'");
    expect(sql).toContain("FOR UPDATE");
    expect(params).toEqual([2]);
  });

  it("denies inactive or missing staff", async () => {
    mocks.execute.mockResolvedValueOnce([[], []]);

    const result = await verifyLaunchApproverAuthority(
      connection,
      2
    );

    expect(result).toBe(false);
  });

  it("denies staff without a Super Admin role", async () => {
    mocks.execute.mockResolvedValueOnce([[], []]);

    const result = await verifyLaunchApproverAuthority(
      connection,
      3
    );

    expect(result).toBe(false);
  });

  it("rejects invalid identifiers without database access", async () => {
    expect(
      await verifyLaunchApproverAuthority(
        connection,
        -1
      )
    ).toBe(false);

    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
