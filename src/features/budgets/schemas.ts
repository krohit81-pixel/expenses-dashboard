import { z } from "zod";

import { zNonNegativeMoney } from "@/lib/money";

export const createBudgetInputSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200),
    currencyCode: z
      .string()
      .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. USD"),
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
  })
  .refine((value) => value.periodEnd >= value.periodStart, {
    message: "End date must be on or after the start date",
    path: ["periodEnd"],
  });

export type CreateBudgetInput = z.infer<typeof createBudgetInputSchema>;

export const setBudgetLineInputSchema = z.object({
  budgetId: z.uuid(),
  categoryId: z.uuid(),
  plannedAmount: zNonNegativeMoney,
  rolloverEnabled: z.boolean().default(false),
});

export type SetBudgetLineInput = z.infer<typeof setBudgetLineInputSchema>;
