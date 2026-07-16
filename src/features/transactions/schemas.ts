import { z } from "zod";

import { addMoney, compareMoney, zPositiveMoney, ZERO } from "@/lib/money";

const splitInputSchema = z.object({
  categoryId: z.uuid(),
  amount: zPositiveMoney,
  memo: z.string().trim().max(500).nullable().optional(),
});

/**
 * `kind: "adjustment"` is deliberately not offered here. The finance schema
 * stores every transaction amount as a positive number and derives sign
 * from `kind`, but the migrations never defined what "adjustment" means
 * directionally (increase or decrease) — there's no separate sign column.
 * The roadmap's Milestone 1 scope is income/expense/transfer/split only,
 * so this is deferred rather than guessed at. Resolve the sign convention
 * (e.g. a signed "delta" column, or split into balance_increase /
 * balance_decrease) before adding adjustment support.
 */
const baseTransactionFields = z.object({
  accountId: z.uuid(),
  currencyCode: z
    .string()
    .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. USD"),
  occurredOn: z.iso.date(),
  payee: z.string().trim().max(300).nullable().optional(),
  memo: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(["pending", "posted"]).default("pending"),
  /**
   * Which month's cash-flow plan this counts toward, e.g. "2026-08" —
   * distinct from occurredOn (a card payment made 30 Jul can be tagged
   * to August's cycle). Optional: when omitted, the service defaults it
   * to occurredOn's own month, so callers that don't care about the
   * cycle concept (existing forms, generateDueTransactions) keep working
   * unchanged. Explicitly passing null is different from omitting it —
   * null means "leave untagged," which the Budget snapshot then excludes
   * entirely until someone tags it.
   */
  cycleMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Use YYYY-MM, e.g. 2026-08")
    .nullable()
    .optional(),
});

const singleCategorySchema = baseTransactionFields.extend({
  kind: z.enum(["income", "expense"]),
  amount: zPositiveMoney,
  categoryId: z.uuid().nullable().optional(),
  splits: z.undefined().optional(),
});

const splitCategorySchema = baseTransactionFields.extend({
  kind: z.enum(["income", "expense"]),
  amount: zPositiveMoney,
  categoryId: z.undefined().optional(),
  splits: z
    .array(splitInputSchema)
    .min(2, "Use at least two splits, or a single category instead"),
});

const transferSchema = baseTransactionFields.extend({
  kind: z.literal("transfer"),
  amount: zPositiveMoney,
  transferAccountId: z.uuid(),
});

export const createTransactionInputSchema = z
  .union([transferSchema, splitCategorySchema, singleCategorySchema])
  .superRefine((value, ctx) => {
    if (value.kind === "transfer") {
      if (value.transferAccountId === value.accountId) {
        ctx.addIssue({
          code: "custom",
          message: "Transfer destination must be a different account",
          path: ["transferAccountId"],
        });
      }
      return;
    }

    if ("splits" in value && value.splits) {
      const total = value.splits.reduce(
        (sum, split) => addMoney(sum, split.amount),
        ZERO,
      );
      if (compareMoney(total, value.amount) !== 0) {
        ctx.addIssue({
          code: "custom",
          message: `Splits must add up to the transaction amount (${value.amount}), got ${total}`,
          path: ["splits"],
        });
      }
    }
  });

export type CreateTransactionInput = z.infer<
  typeof createTransactionInputSchema
>;

/**
 * Narrow, deliberately: editing a transaction's account/kind/category
 * after the fact touches balance history in ways that need more care
 * than this covers. This handles the actual need that came up — fixing
 * a scheduled card payment's amount or date before it's paid, and
 * tagging which billing cycle it belongs to (memo) when that's not
 * obvious from the pay date alone (e.g. paying early from this month's
 * salary for a bill that's technically due next month).
 */
export const updateTransactionInputSchema = z.object({
  id: z.uuid(),
  amount: zPositiveMoney,
  occurredOn: z.iso.date(),
  memo: z.string().trim().max(300).nullable().optional(),
  cycleMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Use YYYY-MM, e.g. 2026-08")
    .nullable()
    .optional(),
});

export type UpdateTransactionInput = z.infer<
  typeof updateTransactionInputSchema
>;
