import { z } from "zod";

const secureUrl = z.string()
  .url()
  .max(500)
  .refine(
    value => new URL(value).protocol === "https:",
    "HTTPS URL required"
  );

export const updateProductSchema = z.object({
  product_name: z.string()
    .trim()
    .min(2)
    .max(160)
    .optional(),

  application_url: secureUrl
    .nullable()
    .optional(),

  onboarding_url: secureUrl
    .nullable()
    .optional()
})
.strict()
.refine(
  value => Object.keys(value).length > 0,
  "At least one field is required"
);

export type UpdateProductInput =
  z.infer<typeof updateProductSchema>;
