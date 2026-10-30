import { z } from "zod";

export const createProductSchema = z.object({
  product_code: z.string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]{1,39}$/),
  product_name: z.string()
    .trim()
    .min(2)
    .max(160),
  application_url: z.string()
    .url()
    .max(500)
    .refine(value => new URL(value).protocol === "https:")
    .optional(),
  provisioning_mode: z.enum(["API", "MANUAL"])
    .default("API")
}).strict();

export const productListSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "RETIRED"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100)
    .default(20),
  cursor: z.coerce.number().int().nonnegative()
    .default(0)
});

export type CreateProductInput =
  z.infer<typeof createProductSchema>;


