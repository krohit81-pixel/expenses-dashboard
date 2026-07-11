import "server-only";

import { dbNumberToMoney, moneyToDbNumber, type Money } from "@/lib/money";
import { createServiceClient } from "@/lib/supabase/service";
import { OWNER_USER_ID } from "@/lib/owner";
import {
  createLiabilityInputSchema,
  type CreateLiabilityInput,
} from "@/features/net-worth/schemas";
import type { Enum } from "@/lib/db/helpers";

export type { CreateLiabilityInput };

export interface Liability {
  id: string;
  accountId: string | null;
  liabilityType: Enum<"liability_type">;
  name: string;
  originalAmount: Money | null;
  interestRate: number | null;
  currencyCode: string;
  dueOn: string | null;
  notes: string | null;
}

function mapRow(row: {
  id: string;
  account_id: string | null;
  liability_type: Enum<"liability_type">;
  name: string;
  original_amount: number | null;
  interest_rate: number | null;
  currency_code: string;
  due_on: string | null;
  notes: string | null;
}): Liability {
  return {
    id: row.id,
    accountId: row.account_id,
    liabilityType: row.liability_type,
    name: row.name,
    originalAmount:
      row.original_amount == null ? null : dbNumberToMoney(row.original_amount),
    interestRate: row.interest_rate,
    currencyCode: row.currency_code,
    dueOn: row.due_on,
    notes: row.notes,
  };
}

export async function listLiabilities(): Promise<Liability[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("liabilities")
    .select(
      "id, account_id, liability_type, name, original_amount, interest_rate, currency_code, due_on, notes",
    )
    .eq("user_id", OWNER_USER_ID)
    .order("name");

  if (error) {
    throw new Error(`Failed to load liabilities: ${error.message}`);
  }

  return data.map(mapRow);
}

/** Creates a standalone liability (not linked to an account). */
export async function createLiability(
  input: CreateLiabilityInput,
): Promise<Liability> {
  const parsed = createLiabilityInputSchema.parse(input);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("liabilities")
    .insert({
      user_id: OWNER_USER_ID,
      liability_type: parsed.liabilityType,
      name: parsed.name,
      original_amount:
        parsed.originalAmount != null
          ? moneyToDbNumber(parsed.originalAmount)
          : null,
      interest_rate: parsed.interestRate ?? null,
      currency_code: parsed.currencyCode,
      due_on: parsed.dueOn ?? null,
      notes: parsed.notes ?? null,
    })
    .select(
      "id, account_id, liability_type, name, original_amount, interest_rate, currency_code, due_on, notes",
    )
    .single();

  if (error) {
    throw new Error(`Failed to create liability: ${error.message}`);
  }

  return mapRow(data);
}
