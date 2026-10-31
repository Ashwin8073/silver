import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

const mocks = vi.hoisted(() => ({
  getConnection: vi.fn(),
  beginTransaction: vi.fn(),
  execute: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  readSnapshotHash: vi.fn()
}));

vi.mock("../src/database/pool.js", () => ({
  pool: {
    getConnection: mocks.getConnection
  }
}));

vi.mock("../src/modules/products/product.launch.snapshot.repository.js", () => ({
  readLaunchConfigurationHash: mocks.readSnapshotHash
}));

import {
  recordLaunchApprovalDecision
} from "../src/modules/products/product.launch.approval.service.js";

import {
  hashLaunchRequestBody
} from "../src/modules/products/product.launch.request-integrity.js";

const publicId = "12345678-1234-1234-1234-123456789abc";

const launchBody = JSON.stringify({
  schema_version: 1,
  product_code: "TEST_PRODUCT",
  configuration_sha256: "a".repeat(64)
});

const approvalRequest = {
  request_body_json: launchBody,
  request_sha256: hashLaunchRequestBody(launchBody),
  id: 8,
  product_id: 25,
  operation_code: "PRODUCT_LAUNCH",
  target_type: "PRODUCT",
  status: "PENDING",
  requested_by_staff_id: 1,
  expires_at: null
};

function setup(
  request = approvalRequest,
  affectedRows = 1
) {
  mocks.getConnection.mockResolvedValue({
    beginTransaction: mocks.beginTransaction,
    execute: mocks.execute,
    commit: mocks.commit,
    rollback: mocks.rollback,
    release: mocks.release
  });

  mocks.execute
    .mockResolvedValueOnce([[{ id: 25, status: "DRAFT" }], []])
    .mockResolvedValueOnce([[request], []])
    .mockResolvedValueOnce([{ affectedRows }, []])
    .mockResolvedValueOnce([{ affectedRows: 1 }, []]);
}

describe("Launch approval transaction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.readSnapshotHash.mockResolvedValue(
      "a".repeat(64)
    );
  });

  it("approves and audits in one transaction", async () => {
    setup();

    const result = await recordLaunchApprovalDecision(
      "TEST_PRODUCT",
      publicId,
      "APPROVE",
      2,
      ["SUPER_ADMIN"]
    );

    expect(result).toEqual({
      status: "RECORDED",
      decision: "APPROVED"
    });

    expect(mocks.beginTransaction).toHaveBeenCalledOnce();
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.rollback).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
    expect(mocks.execute).toHaveBeenCalledTimes(4);

    const [productSql] = mocks.execute.mock.calls[0];
    const [requestSql] = mocks.execute.mock.calls[1];
    const [auditSql] = mocks.execute.mock.calls[3];

    expect(productSql).toContain("FOR UPDATE");
    expect(requestSql).toContain("FOR UPDATE");
    expect(auditSql).toContain("INSERT INTO audit_logs");
  });

  it("rejects self approval without writing", async () => {
    setup();

    const result = await recordLaunchApprovalDecision(
      "TEST_PRODUCT",
      publicId,
      "APPROVE",
      1,
      ["SUPER_ADMIN"]
    );

    expect(result).toEqual({
      status: "DENIED",
      reason: "SELF_APPROVAL_FORBIDDEN"
    });
    expect(mocks.execute).toHaveBeenCalledTimes(2);
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("prevents approving a completed request", async () => {
    setup({ ...approvalRequest, status: "APPROVED" });

    const result = await recordLaunchApprovalDecision(
      "TEST_PRODUCT",
      publicId,
      "APPROVE",
      2,
      ["SUPER_ADMIN"]
    );

    expect(result).toEqual({
      status: "DENIED",
      reason: "REQUEST_NOT_PENDING"
    });
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("rolls back when audit logging fails", async () => {
    setup();
    mocks.execute
      .mockReset()
      .mockResolvedValueOnce([[{ id: 25, status: "DRAFT" }], []])
      .mockResolvedValueOnce([[approvalRequest], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockRejectedValueOnce(new Error("Audit unavailable"));

    await expect(
      recordLaunchApprovalDecision(
        "TEST_PRODUCT",
        publicId,
        "APPROVE",
        2,
        ["SUPER_ADMIN"]
      )
    ).rejects.toThrow("Audit unavailable");

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("blocks concurrent status changes", async () => {
    setup(approvalRequest, 0);

    await expect(
      recordLaunchApprovalDecision(
        "TEST_PRODUCT",
        publicId,
        "APPROVE",
        2,
        ["SUPER_ADMIN"]
      )
    ).rejects.toThrow("APPROVAL_CONCURRENT_MODIFICATION");

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("rejects non-admin calls before opening DB", async () => {
    const result = await recordLaunchApprovalDecision(
      "TEST_PRODUCT",
      publicId,
      "APPROVE",
      3,
      ["PRODUCT_ADMIN"]
    );

    expect(result).toEqual({
      status: "DENIED",
      reason: "SUPER_ADMIN_REQUIRED"
    });
    expect(mocks.getConnection).not.toHaveBeenCalled();
  });
  it("rejects a tampered request and rolls back", async () => {
    setup({
      ...approvalRequest,
      request_body_json: launchBody.replace(
        "TEST_PRODUCT",
        "OTHER_PRODUCT"
      )
    });

    const result = await recordLaunchApprovalDecision(
      "TEST_PRODUCT",
      publicId,
      "APPROVE",
      2,
      ["SUPER_ADMIN"]
    );

    expect(result).toEqual({
      status: "DENIED",
      reason: "REQUEST_HASH_MISMATCH"
    });

    expect(mocks.execute).toHaveBeenCalledTimes(2);
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("rejects malformed stored request JSON", async () => {
    const invalidBody = '{"schema_version":';

    setup({
      ...approvalRequest,
      request_body_json: invalidBody,
      request_sha256: hashLaunchRequestBody(invalidBody)
    });

    const result = await recordLaunchApprovalDecision(
      "TEST_PRODUCT",
      publicId,
      "APPROVE",
      2,
      ["SUPER_ADMIN"]
    );

    expect(result).toEqual({
      status: "DENIED",
      reason: "INVALID_REQUEST_JSON"
    });

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("rejects a request for another product", async () => {
    const otherBody = JSON.stringify({
      schema_version: 1,
      product_code: "OTHER_PRODUCT",
      configuration_sha256: "a".repeat(64)
    });

    setup({
      ...approvalRequest,
      request_body_json: otherBody,
      request_sha256: hashLaunchRequestBody(otherBody)
    });

    const result = await recordLaunchApprovalDecision(
      "TEST_PRODUCT",
      publicId,
      "APPROVE",
      2,
      ["SUPER_ADMIN"]
    );

    expect(result).toEqual({
      status: "DENIED",
      reason: "REQUEST_PRODUCT_MISMATCH"
    });

    expect(mocks.execute).toHaveBeenCalledTimes(2);
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
  it("rejects an outdated configuration fingerprint", async () => {
    setup();

    mocks.readSnapshotHash.mockResolvedValueOnce(
      "b".repeat(64)
    );

    const result = await recordLaunchApprovalDecision(
      "TEST_PRODUCT",
      publicId,
      "APPROVE",
      2,
      ["SUPER_ADMIN"]
    );

    expect(result).toEqual({
      status: "DENIED",
      reason: "STALE_PRODUCT_CONFIGURATION"
    });

    expect(mocks.execute).toHaveBeenCalledTimes(2);
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("rolls back when live configuration cannot be read", async () => {
    setup();

    mocks.readSnapshotHash.mockRejectedValueOnce(
      new Error("CONFIGURATION_UNAVAILABLE")
    );

    await expect(
      recordLaunchApprovalDecision(
        "TEST_PRODUCT",
        publicId,
        "APPROVE",
        2,
        ["SUPER_ADMIN"]
      )
    ).rejects.toThrow("CONFIGURATION_UNAVAILABLE");

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("permits rejection even when configuration is stale", async () => {
    setup();

    mocks.readSnapshotHash.mockResolvedValueOnce(
      "b".repeat(64)
    );

    const result = await recordLaunchApprovalDecision(
      "TEST_PRODUCT",
      publicId,
      "REJECT",
      2,
      ["SUPER_ADMIN"]
    );

    expect(result).toEqual({
      status: "RECORDED",
      decision: "REJECTED"
    });

    expect(mocks.readSnapshotHash).not.toHaveBeenCalled();
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
});
