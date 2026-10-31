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
  MANDATORY_LAUNCH_CHECKS,
  evaluateMandatoryLaunchChecks,
  getMandatoryLaunchChecklist
} from "../src/modules/products/product.launch.checklist.js";

import type {
  LaunchCheckRow
} from "../src/modules/products/product.launch.checklist.js";

function check(
  code: string,
  status = "PASSED",
  verifier: number | null = 1,
  time: Date | null = new Date("2026-10-30T10:00:00Z")
): LaunchCheckRow {
  return {
    check_code: code,
    status,
    verified_by_staff_id: verifier,
    verified_at: time
  } as LaunchCheckRow;
}

describe("Mandatory launch checklist", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("defines five mandatory checks", () => {
    expect(MANDATORY_LAUNCH_CHECKS).toHaveLength(5);
  });

  it("blocks missing records", () => {
    const result = evaluateMandatoryLaunchChecks([]);

    expect(result.blockers).toHaveLength(5);
    expect(result.activation_enabled).toBe(false);
  });

  it("rejects pending checks", () => {
    const result = evaluateMandatoryLaunchChecks([
      check("PRODUCT_CONFIG", "PENDING")
    ]);

    expect(result.verified_count).toBe(0);
  });

  it("rejects failed checks", () => {
    const result = evaluateMandatoryLaunchChecks([
      check("PRODUCT_CONFIG", "FAILED")
    ]);

    expect(result.verified_count).toBe(0);
  });

  it("requires verifier identity and verification time", () => {
    const result = evaluateMandatoryLaunchChecks([
      check("PRODUCT_CONFIG", "PASSED", null),
      check("PLAN_PRICING", "PASSED", 1, null)
    ]);

    expect(result.verified_count).toBe(0);
  });

  it("blocks duplicate checklist entries", () => {
    const result = evaluateMandatoryLaunchChecks([
      check("PRODUCT_CONFIG"),
      check("PRODUCT_CONFIG")
    ]);

    expect(result.verified_count).toBe(0);
  });

  it("remains fail-closed when all checks are verified", async () => {
    const rows = MANDATORY_LAUNCH_CHECKS.map(
      code => check(code)
    );

    mocks.execute.mockResolvedValueOnce([rows, []]);

    const result = await getMandatoryLaunchChecklist(25);

    expect(result.verified_count).toBe(5);
    expect(result.all_required_rows_verified).toBe(true);
    expect(result.activation_enabled).toBe(false);

    const [sql, params] = mocks.execute.mock.calls[0];

    expect(sql).toContain("WHERE product_id = ?");
    expect(params).toEqual([25]);
  });
});
