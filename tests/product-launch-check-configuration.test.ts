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
  LaunchCheckInputError,
  recordProductLaunchCheck
} from "../src/modules/products/product.launch-check-configuration.service.js";

const baseInput = {
  product_code: "TEST_PRODUCT",
  check_code: "SECURITY_REVIEW",
  status: "PASSED" as const,
  evidence: {
    reference: "SEC-2026-001",
    summary: "Security review evidence checked and accepted"
  },
  attested_pass: true
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
  mocks.beginTransaction.mockResolvedValue(undefined);
  mocks.commit.mockResolvedValue(undefined);
  mocks.rollback.mockResolvedValue(undefined);
}

function mockDraftProduct(): void {
  mocks.execute.mockResolvedValueOnce([
    [{ id: 10, status: "DRAFT" }],
    []
  ]);
}

describe("Product launch check configuration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(hasApprovedLaunchRequest)
      .mockResolvedValue(false);
    setup();
  });

  it("records an attested passed check atomically", async () => {
    mockDraftProduct();

    const result = await recordProductLaunchCheck(
      baseInput,
      2
    );

    expect(result).toEqual({
      status: "RECORDED",
      check_status: "PASSED"
    });

    expect(mocks.verifyAuthority).toHaveBeenCalledOnce();

    const [productSql] = mocks.execute.mock.calls[0]!;
    const [existingSql] = mocks.execute.mock.calls[1]!;
    const [upsertSql, params] =
      mocks.execute.mock.calls[2]!;
    const [auditSql] = mocks.execute.mock.calls[3]!;

    expect(productSql).toContain("FOR UPDATE");
    expect(existingSql).toContain("FOR UPDATE");
    expect(upsertSql).toContain("UTC_TIMESTAMP(6)");
    expect(upsertSql).toContain(
      "ON DUPLICATE KEY UPDATE"
    );
    expect(auditSql).toContain("INSERT INTO audit_logs");

    expect(params[0]).toBe(10);
    expect(params[2]).toBe("PASSED");
    expect(params[4]).toBe(2);
    expect(params[5]).toBe(1);

    const details = JSON.parse(params[3]);

    expect(details.evidence_reference).toBe(
      "SEC-2026-001"
    );

    expect(mocks.commit).toHaveBeenCalledOnce();
  });

  it("clears verification for a pending check", async () => {
    mockDraftProduct();

    mocks.execute.mockResolvedValueOnce([
      [{ id: 7, status: "PASSED" }],
      []
    ]);

    const result = await recordProductLaunchCheck(
      {
        ...baseInput,
        status: "PENDING",
        evidence: null,
        attested_pass: false
      },
      2
    );

    expect(result.check_status).toBe("PENDING");

    const params = mocks.execute.mock.calls[2]![1];

    expect(params[3]).toBeNull();
    expect(params[4]).toBeNull();
    expect(params[5]).toBe(0);

    expect(mocks.commit).toHaveBeenCalledOnce();
  });

  it("records a failed check without verifier metadata", async () => {
    mockDraftProduct();

    const result = await recordProductLaunchCheck(
      {
        ...baseInput,
        status: "FAILED",
        attested_pass: false
      },
      2
    );

    expect(result.check_status).toBe("FAILED");

    const params = mocks.execute.mock.calls[2]![1];

    expect(params[4]).toBeNull();
    expect(params[5]).toBe(0);
  });

  it("rejects a passed check without evidence", async () => {
    await expect(
      recordProductLaunchCheck(
        {
          ...baseInput,
          evidence: null
        },
        2
      )
    ).rejects.toBeInstanceOf(LaunchCheckInputError);

    expect(mocks.getConnection).not.toHaveBeenCalled();
  });

  it("rejects a passed check without attestation", async () => {
    await expect(
      recordProductLaunchCheck(
        {
          ...baseInput,
          attested_pass: false
        },
        2
      )
    ).rejects.toBeInstanceOf(LaunchCheckInputError);

    expect(mocks.getConnection).not.toHaveBeenCalled();
  });

  it("rejects unknown launch check codes", async () => {
    await expect(
      recordProductLaunchCheck(
        {
          ...baseInput,
          check_code: "UNAPPROVED_CHECK"
        },
        2
      )
    ).rejects.toBeInstanceOf(LaunchCheckInputError);

    expect(mocks.getConnection).not.toHaveBeenCalled();
  });

  it("blocks checks on active products", async () => {
    mocks.execute.mockResolvedValueOnce([
      [{ id: 10, status: "ACTIVE" }],
      []
    ]);

    const result = await recordProductLaunchCheck(
      baseInput,
      2
    );

    expect(result.status).toBe("PRODUCT_NOT_EDITABLE");
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("blocks staff whose authority was revoked", async () => {
    mockDraftProduct();

    mocks.verifyAuthority.mockResolvedValue(false);

    const result = await recordProductLaunchCheck(
      baseInput,
      2
    );

    expect(result.status).toBe("STAFF_FORBIDDEN");
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("denies invalid existing check states", async () => {
    mockDraftProduct();

    mocks.execute.mockResolvedValueOnce([
      [{ id: 7, status: "UNKNOWN" }],
      []
    ]);

    const result = await recordProductLaunchCheck(
      baseInput,
      2
    );

    expect(result.status).toBe("INVALID_EXISTING_CHECK");
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("rolls back when audit insertion fails", async () => {
    mockDraftProduct();

    mocks.execute
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([{}, []])
      .mockRejectedValueOnce(
        new Error("AUDIT_INSERT_FAILED")
      );

    await expect(
      recordProductLaunchCheck(
        baseInput,
        2
      )
    ).rejects.toThrow("AUDIT_INSERT_FAILED");

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });
  it("audits previous and new evidence hashes", async () => {
    mockDraftProduct();

    const oldEvidence = JSON.stringify({
      schema_version: 1,
      evidence_reference: "SEC-OLD-001",
      evidence_summary: "Previous security review evidence"
    });

    mocks.execute.mockResolvedValueOnce([
      [{
        id: 7,
        status: "PASSED",
        details_json: oldEvidence
      }],
      []
    ]);

    await recordProductLaunchCheck(
      baseInput,
      2
    );

    const [auditSql, auditParams] =
      mocks.execute.mock.calls[3]!;

    expect(auditSql).toContain("INSERT INTO audit_logs");

    const details = JSON.parse(auditParams[6]);

    expect(details.previous_status).toBe("PASSED");
    expect(details.new_status).toBe("PASSED");

    expect(
      details.previous_evidence_sha256
    ).toMatch(/^[a-f0-9]{64}$/);

    expect(
      details.new_evidence_sha256
    ).toMatch(/^[a-f0-9]{64}$/);

    expect(
      details.previous_evidence_sha256
    ).not.toBe(
      details.new_evidence_sha256
    );

    expect(details.evidence_changed).toBe(true);

    expect(auditParams[6]).not.toContain(
      "Previous security review evidence"
    );

    expect(mocks.commit).toHaveBeenCalledOnce();
  });

  it("audits evidence removal when a check is reset", async () => {
    mockDraftProduct();

    mocks.execute.mockResolvedValueOnce([
      [{
        id: 7,
        status: "PASSED",
        details_json: '{"reference":"old-review"}'
      }],
      []
    ]);

    await recordProductLaunchCheck(
      {
        ...baseInput,
        status: "PENDING",
        evidence: null,
        attested_pass: false
      },
      2
    );

    const auditParams =
      mocks.execute.mock.calls[3]![1];

    const details = JSON.parse(auditParams[6]);

    expect(
      details.previous_evidence_sha256
    ).toMatch(/^[a-f0-9]{64}$/);

    expect(details.new_evidence_sha256).toBeNull();
    expect(details.evidence_changed).toBe(true);

    expect(mocks.commit).toHaveBeenCalledOnce();
  });

  it("rejects malformed stored evidence types", async () => {
    mockDraftProduct();

    mocks.execute.mockResolvedValueOnce([
      [{
        id: 7,
        status: "PASSED",
        details_json: { unexpected: "object" }
      }],
      []
    ]);

    await expect(
      recordProductLaunchCheck(
        baseInput,
        2
      )
    ).rejects.toThrow(
      "INVALID_STORED_LAUNCH_EVIDENCE"
    );

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
  it("blocks launch-check evidence changes after approval", async () => {
    mockDraftProduct();

    vi.mocked(hasApprovedLaunchRequest)
      .mockResolvedValue(true);

    const result = await recordProductLaunchCheck(
      baseInput,
      2
    );

    expect(result.status).toBe(
      "PRODUCT_NOT_EDITABLE"
    );

    expect(hasApprovedLaunchRequest)
      .toHaveBeenCalledOnce();

    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });
});
