import "server-only";

import { dbNumberToMoney, moneyToDbNumber, type Money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import {
  createAssetInputSchema,
  type CreateAssetInput,
} from "@/features/net-worth/schemas";
import type { Enum } from "@/lib/db/helpers";

export type { CreateAssetInput };

export interface Asset {
  id: string;
  accountId: string | null;
  assetType: Enum<"asset_type">;
  name: string;
  acquiredOn: string | null;
  acquisitionCost: Money | null;
  currencyCode: string;
  notes: string | null;
}

function mapRow(row: {
  id: string;
  account_id: string | null;
  asset_type: Enum<"asset_type">;
  name: string;
  acquired_on: string | null;
  acquisition_cost: number | null;
  currency_code: string;
  notes: string | null;
}): Asset {
  return {
    id: row.id,
    accountId: row.account_id,
    assetType: row.asset_type,
    name: row.name,
    acquiredOn: row.acquired_on,
    acquisitionCost:
      row.acquisition_cost == null
        ? null
        : dbNumberToMoney(row.acquisition_cost),
    currencyCode: row.currency_code,
    notes: row.notes,
  };
}

export async function listAssets(): Promise<Asset[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select(
      "id, account_id, asset_type, name, acquired_on, acquisition_cost, currency_code, notes",
    )
    .order("name");

  if (error) {
    throw new Error(`Failed to load assets: ${error.message}`);
  }

  return data.map(mapRow);
}

/** Creates a standalone asset (not linked to an account). See docs note in NetWorthService about avoiding double-counting when a link is added later. */
export async function createAsset(input: CreateAssetInput): Promise<Asset> {
  const parsed = createAssetInputSchema.parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("assets")
    .insert({
      asset_type: parsed.assetType,
      name: parsed.name,
      acquired_on: parsed.acquiredOn ?? null,
      acquisition_cost:
        parsed.acquisitionCost != null
          ? moneyToDbNumber(parsed.acquisitionCost)
          : null,
      currency_code: parsed.currencyCode,
      notes: parsed.notes ?? null,
    })
    .select(
      "id, account_id, asset_type, name, acquired_on, acquisition_cost, currency_code, notes",
    )
    .single();

  if (error) {
    throw new Error(`Failed to create asset: ${error.message}`);
  }

  return mapRow(data);
}
