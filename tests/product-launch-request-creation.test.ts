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
  authority: vi.fn(),
  assessment: vi.fn()
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

vi.mock(
  "../src/modules/products/product.launch.approval-readiness.js",
  () => ({
    readAssessedLaunchConfiguration:
      mocks.assessment
  })
);

import {
  createProductLaunchRequest
} from "../src/modules/products/product.launch-request.service.js";

import {
  hashLaunchRequestBody
} from "../src/modules/products/product.launch.request-integrity.js";

const input = {
  product_code: "TEST_PRODUCT",
  idempotency_key:
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  expires_in_seconds: 3600
};

const configurationHash = "a".repeat(64);

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

  mocks.assessment.mockResolvedValue({
    hash: configurationHash,
    assessment: {
      configuration_checks_passed: true
    }
  });
}

function draftProduct() {
  mocks.execute.mockResolvedValueOnce([
    [{ id: 10, status: "DRAFT" }],
    []
  ]);
}

describe("Launch approval request creation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setup();
  });

  it("creates a pending request and audit atomically", async () => {
    draftProduct();

    mocks.execute
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([
        { affectedRows: 1 },
        []
      ]);

    const result = await createProductLaunchRequest(
      input,
      2
    );

    expect(result.status).toBe("CREATED");

    const [productSql] = mocks.execute.mock.calls[0]!;
    const [keySql] = mocks.execute.mock.calls[1]!;
    const [pendingSql] = mocks.execute.mock.calls[2]!;
    const [insertSql, insertParams] =
      mocks.execute.mock.calls[3]!;
    const [auditSql] = mocks.execute.mock.calls[4]!;

    expect(productSql).toContain("FOR UPDATE");
    expect(keySql).toContain("FOR UPDATE");
    expect(pendingSql).toContain("FOR UPDATE");
    expect(insertSql).toContain(
      "INSERT INTO platform_change_requests"
    );
    expect(insertSql).toContain("UTC_TIMESTAMP(6)");
    expect(auditSql).toContain("INSERT INTO audit_logs");

    expect(insertParams[1]).toBe("TEST_PRODUCT");
    expect(insertParams[2]).toBe(10);
    expect(insertParams[6]).toBe(2);
    expect(insertParams[7]).toBe(3600);

    const body = JSON.parse(insertParams[3]);

    expect(body.configuration_sha256).toBe(
      configurationHash
    );

    expect(insertParams[4]).toBe(
      hashLaunchRequestBody(insertParams[3])
    );

    expect(mocks.commit).toHaveBeenCalledOnce();
  });

  it("returns an existing request for an identical retry", async () => {
    draftProduct();

    const rawBody = JSON.stringify({
      schema_version: 1,
      product_code: "TEST_PRODUCT",
      configuration_sha256: configurationHash
    });

    mocks.execute.mockResolvedValueOnce([
      [{
        public_id: "11111111-1111-4111-8111-111111111111",
        product_id: 10,
        operation_code: "PRODUCT_LAUNCH",
        target_type: "PRODUCT",
        status: "PENDING",
        requested_by_staff_id: 2,
        request_body_json: rawBody,
        request_sha256: hashLaunchRequestBody(rawBody),
        expiry_seconds: 3600,
        unexpired: 1
      }],
      []
    ]);

    const result = await createProductLaunchRequest(
      input,
      2
    );

    expect(result).toEqual({
      status: "EXISTING",
      request_public_id:
        "11111111-1111-4111-8111-111111111111"
    });

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("denies an idempotency key belonging to another user", async () => {
    draftProduct();

    mocks.execute.mockResolvedValueOnce([
      [{
        public_id: "11111111-1111-4111-8111-111111111111",
        product_id: 10,
        operation_code: "PRODUCT_LAUNCH",
        target_type: "PRODUCT",
        status: "PENDING",
        requested_by_staff_id: 99,
        request_body_json: "{}",
        request_sha256: "a".repeat(64),
        expiry_seconds: 3600,
        unexpired: 1
      }],
      []
    ]);

    expect(
      await createProductLaunchRequest(input, 2)
    ).toEqual({
      status: "IDEMPOTENCY_CONFLICT"
    });

    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("blocks a second valid pending request", async () => {
    draftProduct();

    mocks.execute
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([
        [{ id: 55 }],
        []
      ]);

    expect(
      await createProductLaunchRequest(input, 2)
    ).toEqual({
      status: "PENDING_REQUEST_EXISTS"
    });

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("blocks incomplete launch configuration", async () => {
    draftProduct();

    mocks.assessment.mockResolvedValue({
      hash: configurationHash,
      assessment: {
        configuration_checks_passed: false
      }
    });

    expect(
      await createProductLaunchRequest(input, 2)
    ).toEqual({
      status: "CONFIGURATION_NOT_READY"
    });

    expect(mocks.rollback).toHaveBeenCalledOnce();
  });

  it("blocks revoked Super Admin authority", async () => {
    draftProduct();
    mocks.authority.mockResolvedValue(false);

    expect(
      await createProductLaunchRequest(input, 2)
    ).toEqual({
      status: "STAFF_FORBIDDEN"
    });

    expect(mocks.assessment).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("blocks requests for non-draft products", async () => {
    mocks.execute.mockResolvedValueOnce([
      [{ id: 10, status: "ACTIVE" }],
      []
    ]);

    expect(
      await createProductLaunchRequest(input, 2)
    ).toEqual({
      status: "PRODUCT_NOT_DRAFT"
    });

    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("rejects invalid expiry before database access", async () => {
    await expect(
      createProductLaunchRequest(
        {
          ...input,
          expires_in_seconds: 1
        },
        2
      )
    ).rejects.toThrow("INVALID_REQUEST_EXPIRY");

    expect(mocks.getConnection).not.toHaveBeenCalled();
  });

  it("rolls back if audit insertion fails", async () => {
    draftProduct();

    mocks.execute
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([
        { affectedRows: 1 },
        []
      ])
      .mockRejectedValueOnce(
        new Error("AUDIT_INSERT_FAILED")
      );

    await expect(
      createProductLaunchRequest(input, 2)
    ).rejects.toThrow("AUDIT_INSERT_FAILED");

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("fails closed when snapshot retrieval fails", async () => {
    draftProduct();

    mocks.assessment.mockRejectedValue(
      new Error("SNAPSHOT_UNAVAILABLE")
    );

    await expect(
      createProductLaunchRequest(input, 2)
    ).rejects.toThrow("SNAPSHOT_UNAVAILABLE");

    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
  it("returns an existing retry without reassessing changed configuration", async () => {
    draftProduct();

    const rawBody = JSON.stringify({
      schema_version: 1,
      product_code: "TEST_PRODUCT",
      configuration_sha256: configurationHash
    });

    mocks.execute.mockResolvedValueOnce([
      [{
        public_id: "11111111-1111-4111-8111-111111111111",
        product_id: 10,
        operation_code: "PRODUCT_LAUNCH",
        target_type: "PRODUCT",
        status: "PENDING",
        requested_by_staff_id: 2,
        request_body_json: rawBody,
        request_sha256: hashLaunchRequestBody(rawBody),
        expiry_seconds: 3600,
        unexpired: 1
      }],
      []
    ]);

    mocks.assessment.mockResolvedValue({
      hash: "b".repeat(64),
      assessment: {
        configuration_checks_passed: false
      }
    });

    const result = await createProductLaunchRequest(
      input,
      2
    );

    expect(result).toEqual({
      status: "EXISTING",
      request_public_id:
        "11111111-1111-4111-8111-111111111111"
    });

    expect(mocks.assessment).not.toHaveBeenCalled();
    expect(mocks.execute).toHaveBeenCalledTimes(2);
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("detects another pending request before reassessing configuration", async () => {
    draftProduct();

    mocks.execute
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([
        [{ id: 55 }],
        []
      ]);

    mocks.assessment.mockRejectedValue(
      new Error("READINESS_UNAVAILABLE")
    );

    const result = await createProductLaunchRequest(
      input,
      2
    );

    expect(result).toEqual({
      status: "PENDING_REQUEST_EXISTS"
    });

    expect(mocks.assessment).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
  it("rejects a retry that changes the original expiry duration", async () => {
    draftProduct();

    const rawBody = JSON.stringify({
      schema_version: 1,
      product_code: "TEST_PRODUCT",
      configuration_sha256: configurationHash
    });

    mocks.execute.mockResolvedValueOnce([
      [{
        public_id: "11111111-1111-4111-8111-111111111111",
        product_id: 10,
        operation_code: "PRODUCT_LAUNCH",
        target_type: "PRODUCT",
        status: "PENDING",
        requested_by_staff_id: 2,
        request_body_json: rawBody,
        request_sha256: hashLaunchRequestBody(rawBody),
        expiry_seconds: 3600,
        unexpired: 1
      }],
      []
    ]);

    const result = await createProductLaunchRequest(
      {
        ...input,
        expires_in_seconds: 7200
      },
      2
    );

    expect(result).toEqual({
      status: "IDEMPOTENCY_CONFLICT"
    });

    expect(mocks.assessment).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledOnce();
  });
  it("uses one statement timestamp for request creation and expiry", async () => {
    draftProduct();

    mocks.execute
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([
        { affectedRows: 1 },
        []
      ]);

    const result = await createProductLaunchRequest(
      input,
      2
    );

    expect(result.status).toBe("CREATED");

    const [insertSql, insertParams] =
      mocks.execute.mock.calls[3]!;

    expect(insertSql).toContain(
      "requested_at, expires_at"
    );

    expect(insertSql).toContain(
      "?, UTC_TIMESTAMP(6),"
    );

    expect(insertSql).toContain(
      "DATE_ADD("
    );

    expect(insertSql).toContain(
      "INTERVAL ? SECOND"
    );

    const timestampCalls = insertSql.match(
      /UTC_TIMESTAMP\(6\)/g
    );

    expect(timestampCalls).toHaveLength(2);
    expect(insertParams).toHaveLength(8);
    expect(insertParams[7]).toBe(3600);

    expect(mocks.commit).toHaveBeenCalledOnce();
  });
});
