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
  ProductConfigurationInputError,
  registerProductIntegration,
  configureProductTrialPolicy
} from "../src/modules/products/product.configuration-integration-trial.service.js";

const integrationInput = {
  product_code: "TEST_PRODUCT",
  integration_code: "TEST_INTEGRATION",
  api_audience: "https://test.example.com",
  secret_reference: "secrets/test/integration"
};

const trialInput = {
  product_code: "TEST_PRODUCT",
  enabled: true,
  trial_days: 14
};

function setup(): void {
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

  mocks.verifyAuthority.mockResolvedValue(true);

  mocks.beginTransaction.mockResolvedValue(
    undefined
  );

  mocks.commit.mockResolvedValue(undefined);
  mocks.rollback.mockResolvedValue(undefined);
}

function mockDraftProduct(): void {
  mocks.execute.mockResolvedValueOnce([
    [{ id: 10, status: "DRAFT" }],
    []
  ]);
}

describe("Product integrations and trial configuration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setup();
  });

  it("registers a disabled integration and audits it", async () => {
    mockDraftProduct();

    const result = await registerProductIntegration(
      integrationInput,
      2
    );

    expect(result).toEqual({
      status: "CREATED"
    });

    expect(mocks.verifyAuthority).toHaveBeenCalledOnce();

    const [lockSql] = mocks.execute.mock.calls[0]!;
    const [readSql] = mocks.execute.mock.calls[1]!;
    const [insertSql, insertParams] =
      mocks.execute.mock.calls[2]!;
    const [auditSql, auditParams] =
      mocks.execute.mock.calls[3]!;

    expect(lockSql).toContain("FROM products");
    expect(lockSql).toContain("FOR UPDATE");

    expect(readSql).toContain(
      "FROM product_integrations"
    );

    expect(insertSql).toContain(
      "INSERT INTO product_integrations"
    );

    expect(insertSql).toContain(
      "'DISABLED'"
    );

    expect(insertParams).toEqual([
      10,
      "TEST_INTEGRATION",
      "https://test.example.com",
      "secrets/test/integration"
    ]);

    expect(auditSql).toContain(
      "INSERT INTO audit_logs"
    );

    expect(JSON.stringify(auditParams)).not.toContain(
      "secrets/test/integration"
    );

    expect(mocks.commit).toHaveBeenCalledOnce();
  });

  it("refuses a second integration for the same product", async () => {
    mockDraftProduct();

    mocks.execute.mockResolvedValueOnce([
      [{ id: 5 }],
      []
    ]);

    const result = await registerProductIntegration(
      integrationInput,
      2
    );

    expect(result.status).toBe(
      "INTEGRATION_ALREADY_EXISTS"
    );

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();

    expect(mocks.execute).toHaveBeenCalledTimes(2);
  });

  it("rejects integration setup without live authority", async () => {
    mockDraftProduct();

    mocks.verifyAuthority.mockResolvedValue(false);

    const result = await registerProductIntegration(
      integrationInput,
      2
    );

    expect(result.status).toBe("STAFF_FORBIDDEN");

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("rejects configuration outside DRAFT status", async () => {
    mocks.execute.mockResolvedValueOnce([
      [{ id: 10, status: "ACTIVE" }],
      []
    ]);

    const result = await configureProductTrialPolicy(
      trialInput,
      2
    );

    expect(result.status).toBe(
      "PRODUCT_NOT_EDITABLE"
    );

    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledOnce();
  });

  it("creates or updates trial policy and audit", async () => {
    mockDraftProduct();

    const result = await configureProductTrialPolicy(
      trialInput,
      2
    );

    expect(result.status).toBe("UPDATED");

    const [productSql] = mocks.execute.mock.calls[0]!;
    const [upsertSql, params] =
      mocks.execute.mock.calls[1]!;
    const [auditSql] = mocks.execute.mock.calls[2]!;

    expect(productSql).toContain("FOR UPDATE");

    expect(upsertSql).toContain(
      "INSERT INTO trial_policies"
    );

    expect(upsertSql).toContain(
      "ON DUPLICATE KEY UPDATE"
    );

    expect(params).toEqual([10, 1, 14]);

    expect(auditSql).toContain(
      "INSERT INTO audit_logs"
    );

    expect(mocks.commit).toHaveBeenCalledOnce();
  });

  it("supports explicitly disabling a trial", async () => {
    mockDraftProduct();

    await configureProductTrialPolicy(
      {
        ...trialInput,
        enabled: false,
        trial_days: 0
      },
      2
    );

    expect(mocks.execute.mock.calls[1]![1]).toEqual([
      10,
      0,
      0
    ]);
  });

  it("rejects enabled zero-day trials before connection", async () => {
    await expect(
      configureProductTrialPolicy(
        {
          ...trialInput,
          trial_days: 0
        },
        2
      )
    ).rejects.toBeInstanceOf(
      ProductConfigurationInputError
    );

    expect(mocks.getConnection).not.toHaveBeenCalled();
  });

  it("rejects invalid secret references before connection", async () => {
    await expect(
      registerProductIntegration(
        {
          ...integrationInput,
          secret_reference: "invalid secret reference"
        },
        2
      )
    ).rejects.toBeInstanceOf(
      ProductConfigurationInputError
    );

    expect(mocks.getConnection).not.toHaveBeenCalled();
  });

  it("rolls back when integration audit insertion fails", async () => {
    mockDraftProduct();

    mocks.execute
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([
        { insertId: 5 },
        []
      ])
      .mockRejectedValueOnce(
        new Error("AUDIT_INSERT_FAILED")
      );

    await expect(
      registerProductIntegration(
        integrationInput,
        2
      )
    ).rejects.toThrow(
      "AUDIT_INSERT_FAILED"
    );

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("handles duplicate integration codes safely", async () => {
    mockDraftProduct();

    mocks.execute
      .mockResolvedValueOnce([[], []])
      .mockRejectedValueOnce(
        Object.assign(
          new Error("Duplicate integration code"),
          { code: "ER_DUP_ENTRY" }
        )
      );

    const result = await registerProductIntegration(
      integrationInput,
      2
    );

    expect(result.status).toBe("CONFLICT");
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
});
