import { z } from "zod";

import { zPositiveMoney } from "@/lib/money";

const baseFields = z.object({
  accountId: z.uuid(),
  currencyCode: z
    .string()
    .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. USD"),
  amount: zPositiveMoney,
  payee: z.string().trim().max(300).nullable().optional(),
  memo: z.string().trim().max(1000).nullable().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
  intervalCount: z.number().int().min(1).max(365).default(1),
  startsOn: z.iso.date(),
  endsOn: z.iso.date().nullable().optional(),
});

const incomeExpenseSchema = baseFields.extend({
  kind: z.enum(["income", "expense"]),
  // Required here, unlike baseFields' optional default — a category
  // alone doesn't distinguish two things in the same category (e.g. two
  // home loan EMIs both under "Housing & loans"). Transfers don't need
  // this same requirement since the account pairing already identifies
  // them.
  payee: z.string().trim().min(1, "Name is required").max(300),
  // Splits aren't supported for recurring templates yet — a single
  // category per template covers the common cases (rent, salary, a fixed
  // bill) and keeps generation simple. Extend to
  // recurring_transaction_splits (already modeled in the schema) if a
  // split recurring transaction turns out to be needed.
  categoryId: z.uuid(),
});

const transferSchema = baseFields.extend({
  kind: z.literal("transfer"),
  transferAccountId: z.uuid(),
});

export const createRecurringTransactionInputSchema = z
  .union([incomeExpenseSchema, transferSchema])
  .superRefine((value, ctx) => {
    if (
      value.kind === "transfer" &&
      value.transferAccountId === value.accountId
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Transfer destination must be a different account",
        path: ["transferAccountId"],
      });
    }
    if (value.endsOn && value.endsOn < value.startsOn) {
      ctx.addIssue({
        code: "custom",
        message: "End date cannot be before the start date",
        path: ["endsOn"],
      });
    }
  });

export type CreateRecurringTransactionInput = z.infer<
  typeof createRecurringTransactionInputSchema
>;

/**
 * Deliberately narrow: the Budgets screen only lets you edit a template's
 * name, amount, and day-of-month, not its frequency/interval/accounts.
 * That covers the actual use case (salary changed, EMI amount changed) —
 * changing which account or how often something recurs is rare enough to
 * not need a UI yet; delete and recreate the template for that until it
 * comes up as a real need.
 */
export const updateRecurringTransactionInputSchema = z.object({
  id: z.uuid(),
  payee: z.string().trim().min(1, "Name is required").max(300),
  amount: zPositiveMoney,
  dayOfMonth: z.number().int().min(1).max(31),
});

export type UpdateRecurringTransactionInput = z.infer<
  typeof updateRecurringTransactionInputSchema
>;
