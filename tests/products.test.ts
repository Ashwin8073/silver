import { productListSchema } from '../src/modules/products/product.schema.js';
import { describe, expect, it } from "vitest";
import {
  createProductSchema
} from "../src/modules/products/product.schema.js";

describe("Dynamic product registration validation", () => {
  it("accepts a valid product", () => {
    const result = createProductSchema.safeParse({
      product_code: "TEST_PRODUCT",
      product_name: "Test Product",
      provisioning_mode: "API"
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.provisioning_mode).toBe("API");
    }
  });

  it("rejects invalid product codes", () => {
    const result = createProductSchema.safeParse({
      product_code: "invalid code",
      product_name: "Test Product"
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = createProductSchema.safeParse({
      product_code: "TEST_PRODUCT",
      product_name: "Test Product",
      status: "ACTIVE"
    });

    expect(result.success).toBe(false);
  });

  it("rejects insecure application URLs", () => {
    const result = createProductSchema.safeParse({
      product_code: "TEST_PRODUCT",
      product_name: "Test Product",
      application_url: "http://example.com"
    });

    expect(result.success).toBe(false);
  });
});


describe("Product status filters", () => {
  it.each(["DRAFT", "ACTIVE", "PAUSED", "RETIRED"])(
    "accepts %s",
    (status) => {
      expect(
        productListSchema.safeParse({ status }).success
      ).toBe(true);
    }
  );

  it.each(["INACTIVE", "ARCHIVED"])(
    "rejects unsupported %s",
    (status) => {
      expect(
        productListSchema.safeParse({ status }).success
      ).toBe(false);
    }
  );
});
