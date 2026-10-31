import {
  createHash,
  timingSafeEqual
} from "node:crypto";

import { z } from "zod";

export const launchRequestBodySchema = z.object({
  schema_version: z.literal(1),
  product_code: z.string()
    .regex(/^[A-Z][A-Z0-9_]{1,39}$/),
  configuration_sha256: z.string()
    .regex(/^[a-f0-9]{64}$/)
}).strict();

export type LaunchRequestBody =
  z.infer<typeof launchRequestBodySchema>;

export type LaunchRequestIntegrityResult =
  | {
      valid: true;
      body: LaunchRequestBody;
    }
  | {
      valid: false;
      reason: string;
    };

export function hashLaunchRequestBody(
  rawBody: string
): string {
  return createHash("sha256")
    .update(rawBody, "utf8")
    .digest("hex");
}

export function verifyLaunchRequestIntegrity(
  rawBody: string,
  storedHash: string,
  expectedProductCode: string
): LaunchRequestIntegrityResult {
  const deny = (
    reason: string
  ): LaunchRequestIntegrityResult => ({
    valid: false,
    reason
  });

  if (
    typeof rawBody !== "string" ||
    Buffer.byteLength(rawBody, "utf8") > 16384 ||
    rawBody.length === 0
  ) {
    return deny("INVALID_REQUEST_BODY");
  }

  if (
    typeof storedHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(storedHash)
  ) {
    return deny("INVALID_REQUEST_HASH");
  }

  const actualHash = Buffer.from(
    hashLaunchRequestBody(rawBody),
    "hex"
  );

  const expectedHash = Buffer.from(
    storedHash,
    "hex"
  );

  if (!timingSafeEqual(actualHash, expectedHash)) {
    return deny("REQUEST_HASH_MISMATCH");
  }

  let decoded: unknown;

  try {
    decoded = JSON.parse(rawBody);
  } catch {
    return deny("INVALID_REQUEST_JSON");
  }

  const parsed = launchRequestBodySchema.safeParse(
    decoded
  );

  if (!parsed.success) {
    return deny("INVALID_REQUEST_SCHEMA");
  }

  if (
    parsed.data.product_code !== expectedProductCode
  ) {
    return deny("REQUEST_PRODUCT_MISMATCH");
  }

  return {
    valid: true,
    body: parsed.data
  };
}
