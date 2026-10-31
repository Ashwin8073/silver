import "dotenv/config";

import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../src/app.js";
import {
  updateProductSchema
} from "../src/modules/products/product.update.schema.js";

const prefix = "/api/v1";

describe("Backend HTTP security", () => {
  it.each([
    "/staff/auth/me",
    "/staff/auth/super-admin-check",
    "/staff/products",
    "/staff/products/TEST_PRODUCT",
    "/staff/products/TEST_PRODUCT/launch-overview"
  ])("rejects anonymous GET %s", async (path) => {
    const response = await request(app)
      .get(`${prefix}${path}`);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("rejects anonymous product creation", async () => {
    const response = await request(app)
      .post(`${prefix}/staff/products`)
      .send({
        product_code: "TEST_PRODUCT",
        product_name: "Test Product"
      });

    expect(response.status).toBe(401);
  });

  it("rejects anonymous product updates", async () => {
    const response = await request(app)
      .patch(`${prefix}/staff/products/TEST_PRODUCT`)
      .send({
        product_name: "Updated Product"
      });

    expect(response.status).toBe(401);
  });

  it("rejects malformed JSON with HTTP 400", async () => {
    const response = await request(app)
      .patch(`${prefix}/staff/products/TEST_PRODUCT`)
      .set("Content-Type", "application/json")
      .send('{"product_name":');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_JSON");
  });

  it("rejects invalid public product codes", async () => {
    const response = await request(app)
      .get(`${prefix}/public/products/invalid-code`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_PRODUCT_CODE");
  });
});

describe("DRAFT product update schema security", () => {
  it("accepts a valid name update", () => {
    expect(
      updateProductSchema.safeParse({
        product_name: "Updated Product"
      }).success
    ).toBe(true);
  });

  it("rejects empty update payloads", () => {
    expect(
      updateProductSchema.safeParse({}).success
    ).toBe(false);
  });

  it.each([
    "status",
    "product_code",
    "id",
    "price",
    "created_by_staff_id"
  ])("rejects restricted field %s", (field) => {
    expect(
      updateProductSchema.safeParse({
        product_name: "Updated Product",
        [field]: "UNAUTHORIZED_CHANGE"
      }).success
    ).toBe(false);
  });

  it("rejects insecure application URLs", () => {
    expect(
      updateProductSchema.safeParse({
        application_url: "http://example.com"
      }).success
    ).toBe(false);
  });

  it("accepts HTTPS onboarding URLs", () => {
    expect(
      updateProductSchema.safeParse({
        onboarding_url: "https://example.com/start"
      }).success
    ).toBe(true);
  });
});
