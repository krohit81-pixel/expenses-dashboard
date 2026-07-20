import "server-only";

import { OWNER_USER_ID } from "@/lib/owner";
import { createServiceClient } from "@/lib/supabase/service";

export interface MerchantResolutionInput {
  /** The exact source text as it appeared on the statement, e.g. "GOOGLE CLOUDMUMBAI". */
  rawText: string;
  /** The parser's normalized form, e.g. "Google Cloud" — see each parser's own normalize-merchant.ts. */
  normalizedText: string;
  /** e.g. "hdfc-infinia" — free text, not tied to any one card union (see the migration). */
  sourceBank: string;
  /** Used only as the new merchant's default_currency if one has to be created. */
  currency: string;
}

export interface MerchantResolution {
  merchantId: string;
  /** True if the resolved merchant has no category yet — see credit_card_transactions.needs_review. */
  needsReview: boolean;
}

/**
 * The Merchant Dictionary's matching rule, deterministic and shared by
 * every card parser (per the spec: "Never hardcode categories inside
 * the HDFC/Axis/ICICI parser — all categorization must come from the
 * Merchant Dictionary"). No LLM, no fuzzy matching yet (see NO AI in
 * this feature's spec — that's an explicitly deferred future step):
 *
 *   1. Exact match: an existing alias equal to the raw source text.
 *   2. Normalized match: an existing alias equal to the parser's
 *      normalized text (covers a merchant already known under its
 *      normalized form, e.g. from a differently-shaped raw string a
 *      prior import already resolved).
 *   3. Existing merchant, new alias: a merchant already exists with
 *      this exact normalized name (a different raw variant created it
 *      earlier) — record this raw text as a new alias pointing at it,
 *      so the next time this exact raw text shows up, step 1 hits
 *      directly.
 *   4. Nothing found: create both the merchant and its first alias.
 *      Category is left null and the transaction is flagged for review
 *      — this function never guesses a category.
 */
async function resolveOneMerchant(
  supabase: ReturnType<typeof createServiceClient>,
  input: MerchantResolutionInput,
): Promise<MerchantResolution> {
  const rawText = input.rawText.trim();
  const normalizedText = input.normalizedText.trim();

  const candidateAliases =
    rawText === normalizedText ? [rawText] : [rawText, normalizedText];

  for (const alias of candidateAliases) {
    const { data: aliasRow, error: aliasError } = await supabase
      .from("merchant_aliases")
      .select("merchant_id")
      .eq("user_id", OWNER_USER_ID)
      .eq("alias", alias)
      .maybeSingle();

    if (aliasError) {
      throw new Error(
        `Failed to look up merchant alias: ${aliasError.message}`,
      );
    }
    if (aliasRow) {
      return await withCategoryStatus(supabase, aliasRow.merchant_id);
    }
  }

  const { data: existingMerchant, error: merchantLookupError } = await supabase
    .from("merchants")
    .select("id, atlas_category_id")
    .eq("user_id", OWNER_USER_ID)
    .eq("merchant_name", normalizedText)
    .maybeSingle();

  if (merchantLookupError) {
    throw new Error(
      `Failed to look up merchant: ${merchantLookupError.message}`,
    );
  }

  if (existingMerchant) {
    await insertAlias(supabase, existingMerchant.id, rawText, input.sourceBank);
    return {
      merchantId: existingMerchant.id,
      needsReview: existingMerchant.atlas_category_id === null,
    };
  }

  const { data: newMerchant, error: createMerchantError } = await supabase
    .from("merchants")
    .insert({
      user_id: OWNER_USER_ID,
      merchant_name: normalizedText,
      display_name: normalizedText,
      default_currency: input.currency,
      // Certain about the identity mapping (this raw text really did
      // appear on a real statement) — see the migration's comment on
      // why this isn't confidence in the category, which stays null.
      confidence: 1.0,
      active: true,
    })
    .select("id")
    .single();

  if (createMerchantError || !newMerchant) {
    throw new Error(
      `Failed to create merchant: ${createMerchantError?.message ?? "unknown error"}`,
    );
  }

  await insertAlias(supabase, newMerchant.id, rawText, input.sourceBank);

  return { merchantId: newMerchant.id, needsReview: true };
}

async function insertAlias(
  supabase: ReturnType<typeof createServiceClient>,
  merchantId: string,
  alias: string,
  sourceBank: string,
): Promise<void> {
  const { error } = await supabase.from("merchant_aliases").insert({
    user_id: OWNER_USER_ID,
    merchant_id: merchantId,
    alias,
    source_bank: sourceBank,
    confidence: 1.0,
  });

  if (error) {
    throw new Error(`Failed to save merchant alias: ${error.message}`);
  }
}

async function withCategoryStatus(
  supabase: ReturnType<typeof createServiceClient>,
  merchantId: string,
): Promise<MerchantResolution> {
  const { data, error } = await supabase
    .from("merchants")
    .select("atlas_category_id")
    .eq("id", merchantId)
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to load merchant ${merchantId} while resolving its category status: ${error?.message ?? "not found"}`,
    );
  }

  return { merchantId, needsReview: data.atlas_category_id === null };
}

/**
 * Resolves a whole import's worth of transactions against the Merchant
 * Dictionary in one call, keyed by raw text. Processes unique raw texts
 * SEQUENTIALLY, not in parallel — two different raw variants of the same
 * merchant appearing in one statement (e.g. "GOOGLE CLOUDMUMBAI" and
 * "GOOGLE CLOUDSMUMBAI", both normalizing to "Google Cloud") would
 * otherwise race to insert the same new merchant_name and violate its
 * unique constraint. Sequential resolution makes each insert visible to
 * the next lookup, so the second variant correctly finds the merchant
 * the first one just created instead of colliding with it.
 */
export async function resolveMerchantsForImport(
  inputs: MerchantResolutionInput[],
): Promise<Map<string, MerchantResolution>> {
  const supabase = createServiceClient();
  const byRawText = new Map<string, MerchantResolutionInput>();
  for (const input of inputs) {
    if (!byRawText.has(input.rawText)) {
      byRawText.set(input.rawText, input);
    }
  }

  const resolutions = new Map<string, MerchantResolution>();
  for (const [rawText, input] of byRawText) {
    resolutions.set(rawText, await resolveOneMerchant(supabase, input));
  }

  return resolutions;
}
