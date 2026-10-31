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

const mocks = vi.hoisted(() => ({
  getConnection: vi.fn(),
  query: vi.fn(),
  execute: vi.fn(),
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  authority: vi.fn()
}));

vi.mock("../src/database/pool.js", () => ({
  pool: {
    getConnection: mocks.getConnection
  }
}));

vi.mock(
  "../src/modules/products/product.launch.approval-authority.js",
  () => ({
    verifyLaunchApproverAuthority: mocks.authority
  })
);

import {
  activateDraftPlanConfiguration,
  enableProductIntegrationConfiguration
} from "../src/modules/products/product.configuration-readiness.service.js";

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
  mocks.execute.mockResolvedValue([[], []]);
  mocks.authority.mockResolvedValue(true);
}

function draftProduct() {
  mocks.execute.mockResolvedValueOnce([
    [{ id: 10, status: "DRAFT" }],
    []
  ]);
}

describe("Internal readiness transitions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(hasApprovedLaunchRequest)
      .mockResolvedValue(false);
    setup();
  });

  it("activates a configured plan with a current price", async () => {
    draftProduct();

    mocks.execute
      .mockResolvedValueOnce([
        [{ id: 20, status: "DRAFT" }],
        []
      ])
      .mockResolvedValueOnce([
        [{ id: 30 }],
        []
      ])
      .mockResolvedValueOnce([
        { affectedRows: 1 },
        []
      ]);

    const result = await activateDraftPlanConfiguration(
      "TEST_PRODUCT",
      "SILVER",
      2
    );

    expect(result).toBe("UPDATED");

    const [productSql] = mocks.execute.mock.calls[0]!;
    const [planSql] = mocks.execute.mock.calls[1]!;
    const [priceSql] = mocks.execute.mock.calls[2]!;
    const [updateSql] = mocks.execute.mock.calls[3]!;
    const [auditSql] = mocks.execute.mock.calls[4]!;

    expect(productSql).toContain("FOR UPDATE");
    expect(planSql).toContain("FOR UPDATE");
    expect(priceSql).toContain("UTC_TIMESTAMP(6)");
    expect(priceSql).toContain("FOR UPDATE");
    expect(updateSql).toContain("status = 'ACTIVE'");
    expect(auditSql).toContain("INSERT INTO audit_logs");
    expect(mocks.commit).toHaveBeenCalledOnce();
  });

  it("blocks plan activation without current pricing", async () => {
    draftProduct();

    mocks.execute.mockResolvedValueOnce([
      [{ id: 20, status: "DRAFT" }],
      []
    ]);

    expect(
      await activateDraftPlanConfiguration(
        "TEST_PRODUCT",
        "SILVER",
        2
      )
    ).toBe("NO_CURRENT_PRICE");

    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledOnce();
  });

  it("blocks plan changes on non-draft products", async () => {
    mocks.execute.mockResolvedValueOnce([
      [{ id: 10, status: "ACTIVE" }],
      []
    ]);

    expect(
      await activateDraftPlanConfiguration(
        "TEST_PRODUCT",
        "SILVER",
        2
      )
    ).toBe("PRODUCT_NOT_EDITABLE");

    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("blocks revoked staff authority", async () => {
    draftProduct();
    mocks.authority.mockResolvedValue(false);

    expect(
      await activateDraftPlanConfiguration(
        "TEST_PRODUCT",
        "SILVER",
        2
      )
    ).toBe("STAFF_FORBIDDEN");

    expect(mocks.rollback).toHaveBeenCalledOnce();
  });

  it("enables an integration with an audit record", async () => {
    draftProduct();

    mocks.execute
      .mockResolvedValueOnce([
        [{
          id: 40,
          status: "DISABLED",
          integration_code: "CRM_INTEGRATION",
          api_audience: "https://api.example.com"
        }],
        []
      ])
      .mockResolvedValueOnce([
        { affectedRows: 1 },
        []
      ]);

    expect(
      await enableProductIntegrationConfiguration(
        "TEST_PRODUCT",
        2
      )
    ).toBe("UPDATED");

    const [integrationSql] = mocks.execute.mock.calls[1]!;
    const [updateSql] = mocks.execute.mock.calls[2]!;
    const [auditSql] = mocks.execute.mock.calls[3]!;

    expect(integrationSql).toContain("FOR UPDATE");
    expect(updateSql).toContain("status = 'ENABLED'");
    expect(auditSql).toContain("INSERT INTO audit_logs");
    expect(mocks.commit).toHaveBeenCalledOnce();
  });

  it("refuses to enable an unconfigured integration", async () => {
    draftProduct();

    mocks.execute.mockResolvedValueOnce([
      [{
        id: 40,
        status: "DISABLED",
        integration_code: "CRM_INTEGRATION",
        api_audience: ""
      }],
      []
    ]);

    expect(
      await enableProductIntegrationConfiguration(
        "TEST_PRODUCT",
        2
      )
    ).toBe("INTEGRATION_NOT_CONFIGURED");

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("blocks a concurrent status modification", async () => {
    draftProduct();

    mocks.execute
      .mockResolvedValueOnce([
        [{
          id: 40,
          status: "DISABLED",
          integration_code: "CRM_INTEGRATION",
          api_audience: "https://api.example.com"
        }],
        []
      ])
      .mockResolvedValueOnce([
        { affectedRows: 0 },
        []
      ]);

    expect(
      await enableProductIntegrationConfiguration(
        "TEST_PRODUCT",
        2
      )
    ).toBe("CONCURRENT_MODIFICATION");

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("rolls back when the audit insert fails", async () => {
    draftProduct();

    mocks.execute
      .mockResolvedValueOnce([
        [{ id: 20, status: "DRAFT" }],
        []
      ])
      .mockResolvedValueOnce([
        [{ id: 30 }],
        []
      ])
      .mockResolvedValueOnce([
        { affectedRows: 1 },
        []
      ])
      .mockRejectedValueOnce(
        new Error("AUDIT_FAILED")
      );

    await expect(
      activateDraftPlanConfiguration(
        "TEST_PRODUCT",
        "SILVER",
        2
      )
    ).rejects.toThrow("AUDIT_FAILED");

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
  it("blocks plan activation after launch approval", async () => {
    draftProduct();

    vi.mocked(hasApprovedLaunchRequest)
      .mockResolvedValue(true);

    const result = await activateDraftPlanConfiguration(
      "TEST_PRODUCT",
      "SILVER",
      2
    );

    expect(result).toBe(
      "PRODUCT_NOT_EDITABLE"
    );

    expect(hasApprovedLaunchRequest)
      .toHaveBeenCalledOnce();

    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("blocks integration enablement after approval", async () => {
    draftProduct();

    vi.mocked(hasApprovedLaunchRequest)
      .mockResolvedValue(true);

    const result = await enableProductIntegrationConfiguration(
      "TEST_PRODUCT",
      2
    );

    expect(result).toBe(
      "PRODUCT_NOT_EDITABLE"
    );

    expect(hasApprovedLaunchRequest)
      .toHaveBeenCalledOnce();

    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
});
