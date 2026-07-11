import { z } from "zod";

import { zNonNegativeMoney } from "@/lib/money";

export const createAssetInputSchema = z.object({
  assetType: z.enum(["real_estate", "vehicle", "valuable", "other"]),
  name: z.string().trim().min(1, "Name is required").max(200),
  acquiredOn: z.iso.date().nullable().optional(),
  acquisitionCost: zNonNegativeMoney.nullable().optional(),
  currencyCode: z
    .string()
    .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. USD"),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type CreateAssetInput = z.infer<typeof createAssetInputSchema>;

export const createLiabilityInputSchema = z.object({
  liabilityType: z.enum(["personal", "tax", "medical", "other"]),
  name: z.string().trim().min(1, "Name is required").max(200),
  originalAmount: zNonNegativeMoney.nullable().optional(),
  interestRate: z.number().min(0).nullable().optional(),
  currencyCode: z
    .string()
    .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. USD"),
  dueOn: z.iso.date().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type CreateLiabilityInput = z.infer<typeof createLiabilityInputSchema>;
