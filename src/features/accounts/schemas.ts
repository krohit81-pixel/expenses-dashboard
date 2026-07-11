import { z } from "zod";

import { ZERO, zMoney, zNonNegativeMoney } from "@/lib/money";

const baseAccountFields = z.object({
  institutionId: z.uuid().nullable().optional(),
  name: z.string().trim().min(1, "Name is required").max(200),
  currencyCode: z
    .string()
    .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. USD"),
  // Any sign is valid, not just non-negative: a credit_card, loan, or
  // liability account may be created with existing debt, which must be
  // entered as a negative opening balance. See AccountService's note on
  // why the uniform, kind-based balance delta makes "negative = owed"
  // the correct representation across every account type — there's no
  // need for a type-specific schema here.
  openingBalance: zMoney.default(ZERO),
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
