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
  status: z.enum(["pending", "posted"]).default("posted"),
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
