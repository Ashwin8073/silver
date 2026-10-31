import {
  describe,
  expect,
  it
} from "vitest";

import {
  hashLaunchRequestBody,
  verifyLaunchRequestIntegrity
} from "../src/modules/products/product.launch.request-integrity.js";

const configurationHash = "a".repeat(64);

const body = JSON.stringify({
  schema_version: 1,
  product_code: "TEST_PRODUCT",
  configuration_sha256: configurationHash
});

const hash = hashLaunchRequestBody(body);

describe("Launch request integrity", () => {
  it("accepts an unchanged valid request", () => {
    const result = verifyLaunchRequestIntegrity(
      body,
      hash,
      "TEST_PRODUCT"
    );

    expect(result).toEqual({
      valid: true,
      body: {
        schema_version: 1,
        product_code: "TEST_PRODUCT",
        configuration_sha256: configurationHash
      }
    });
  });

  it("rejects tampered request content", () => {
    const changed = body.replace(
      "TEST_PRODUCT",
      "OTHER_PRODUCT"
    );

    expect(
      verifyLaunchRequestIntegrity(
        changed,
        hash,
        "TEST_PRODUCT"
      )
    ).toEqual({
      valid: false,
      reason: "REQUEST_HASH_MISMATCH"
    });
  });

  it("rejects an invalid stored hash", () => {
    const result = verifyLaunchRequestIntegrity(
      body,
      "invalid",
      "TEST_PRODUCT"
    );

    expect(result).toEqual({
      valid: false,
      reason: "INVALID_REQUEST_HASH"
    });
  });

  it("rejects requests for a different product", () => {
    const result = verifyLaunchRequestIntegrity(
      body,
      hash,
      "OTHER_PRODUCT"
    );

    expect(result).toEqual({
      valid: false,
      reason: "REQUEST_PRODUCT_MISMATCH"
    });
  });

  it("rejects unsupported schema versions", () => {
    const changed = JSON.stringify({
      schema_version: 2,
      product_code: "TEST_PRODUCT",
      configuration_sha256: configurationHash
    });

    const result = verifyLaunchRequestIntegrity(
      changed,
      hashLaunchRequestBody(changed),
      "TEST_PRODUCT"
    );

    expect(result).toEqual({
      valid: false,
      reason: "INVALID_REQUEST_SCHEMA"
    });
  });

  it("rejects malformed JSON", () => {
    const raw = '{"schema_version":';

    const result = verifyLaunchRequestIntegrity(
      raw,
      hashLaunchRequestBody(raw),
      "TEST_PRODUCT"
    );

    expect(result).toEqual({
      valid: false,
      reason: "INVALID_REQUEST_JSON"
    });
  });

  it("rejects extra request fields", () => {
    const changed = JSON.stringify({
      schema_version: 1,
      product_code: "TEST_PRODUCT",
      configuration_sha256: configurationHash,
      activate_now: true
    });

    const result = verifyLaunchRequestIntegrity(
      changed,
      hashLaunchRequestBody(changed),
      "TEST_PRODUCT"
    );

    expect(result).toEqual({
      valid: false,
      reason: "INVALID_REQUEST_SCHEMA"
    });
  });

  it("rejects oversized request bodies", () => {
    const oversized = "x".repeat(20000);

    const result = verifyLaunchRequestIntegrity(
      oversized,
      hashLaunchRequestBody(oversized),
      "TEST_PRODUCT"
    );

    expect(result).toEqual({
      valid: false,
      reason: "INVALID_REQUEST_BODY"
    });
  });
});
