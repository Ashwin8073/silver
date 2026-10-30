import { z } from "zod";

export const grantRoleSchema = z.enum([
  "PRODUCT_ADMIN",
  "PRODUCT_BILLING",
  "PRODUCT_SUPPORT",
  "PRODUCT_VIEWER"
]);

export const grantCreateSchema = z.object({
  product_code: z.string()
    .regex(/^[A-Z][A-Z0-9_]{1,39}$/),

  staff_public_id: z.string().uuid(),

  role_code: grantRoleSchema,

  expected_version: z.number()
    .int()
    .min(1)
    .max(Number.MAX_SAFE_INTEGER)
    .optional(),

  expires_at: z.string()
    .datetime({ offset: true })
    .nullable()
    .optional()
}).strict().superRefine((value, ctx) => {
  if (
    value.expires_at &&
    Date.parse(value.expires_at) <= Date.now()
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["expires_at"],
      message: "Expiry must be in the future"
    });
  }
});

export const grantRevokeSchema = z.object({
  expected_version: z.number()
    .int()
    .min(1)
    .max(Number.MAX_SAFE_INTEGER)
}).strict();

export type GrantCreateInput =
  z.infer<typeof grantCreateSchema>;
