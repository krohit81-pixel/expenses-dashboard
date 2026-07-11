import { z } from "zod";

import { ZERO, zNonNegativeMoney } from "@/lib/money";

const baseAccountFields = z.object({
  institutionId: z.uuid().nullable().optional(),
  name: z.string().trim().min(1, "Name is required").max(200),
  currencyCode: z
    .string()
    .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. USD"),
  openingBalance: zNonNegativeMoney.default(ZERO),
  openingBalanceDate: z.iso.date().nullable().optional(),
});

const creditCardFields = z.object({
  creditLimit: zNonNegativeMoney.nullable().optional(),
  statementDay: z.number().int().min(1).max(31).nullable().optional(),
  paymentDueDay: z.number().int().min(1).max(31).nullable().optional(),
  annualPercentageRate: z.number().min(0).nullable().optional(),
});

export const ACCOUNT_TYPES_WITHOUT_CREDIT_CARD_FIELDS = [
  "checking",
  "savings",
  "cash",
  "investment",
  "loan",
  "asset",
  "liability",
] as const;

export const createAccountInputSchema = z.discriminatedUnion("accountType", [
  baseAccountFields
    .extend({ accountType: z.literal("credit_card") })
    .merge(creditCardFields),
  baseAccountFields.extend({
    accountType: z.enum(ACCOUNT_TYPES_WITHOUT_CREDIT_CARD_FIELDS),
  }),
]);

export type CreateAccountInput = z.infer<typeof createAccountInputSchema>;
