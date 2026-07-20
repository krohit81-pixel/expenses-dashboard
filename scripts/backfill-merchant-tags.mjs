#!/usr/bin/env node
/**
 * One-off backfill: tags pre-v1.5.0 credit_card_transactions rows with
 * the Merchant Dictionary, for statements that were imported before the
 * Merchant Dictionary (merchant_id/needs_review columns, see
 * supabase/migrations/20260722*.sql) existed. The live import pipeline
 * (CreditCardStatementService.saveHdfcInfiniaStatement) only resolves
 * merchants for NEW transaction rows at insert time -- re-uploading an
 * already-imported statement is treated as a duplicate and touches
 * nothing (see statement_hash dedup), so old rows stay merchant_id =
 * null forever unless something like this runs once.
 *
 * Applies the exact same deterministic matching algorithm as
 * src/services/MerchantDictionaryService.ts (exact alias match, then
 * normalized alias match, then existing merchant by normalized name,
 * then create new), reimplemented here rather than imported -- this
 * script runs under plain Node (no Next.js bundler, no "@/..." path
 * aliases, and MerchantDictionaryService.ts is marked "server-only",
 * which is meant to be enforced by a bundler, not plain `node`).
 * Keeping the two in sync by hand is an accepted tradeoff for a
 * one-off script, same as every other file in scripts/ not going
 * through the app's module graph.
 *
 * Only touches rows where merchant_id IS NULL AND merchant_raw IS NOT
 * NULL -- safe to re-run any time; already-tagged rows are simply
 * skipped, so a partial run (or running this again after a new import)
 * never double-processes anything.
 *
 * Usage:
 *   node scripts/backfill-merchant-tags.mjs           # applies changes
 *   node scripts/backfill-merchant-tags.mjs --dry-run # preview only, no writes
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
 * APP_OWNER_USER_ID from .env.local (or the environment, if already
 * exported) -- same as scripts/seed-atlas-categories.mjs.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadDotEnvLocal() {
  try {
    const contents = readFileSync(
      new URL("../.env.local", import.meta.url),
      "utf8",
    );
    for (const line of contents.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env.local not present -- fine if the vars are already exported.
  }
}

function slugifySourceBank(issuer, cardType) {
  return `${issuer}-${cardType}`.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Mirrors MerchantDictionaryService.resolveOneMerchant exactly: exact
 * alias match -> normalized alias match -> existing merchant by
 * normalized name -> create new. See that file's own comment for the
 * full rationale (sequential processing to avoid a same-run race
 * between two raw variants of the same merchant).
 */
async function resolveOneMerchant(supabase, ownerUserId, input, dryRun) {
  const rawText = input.rawText.trim();
  const normalizedText = input.normalizedText.trim();
  const candidateAliases =
    rawText === normalizedText ? [rawText] : [rawText, normalizedText];

  for (const alias of candidateAliases) {
    const { data: aliasRow, error: aliasError } = await supabase
      .from("merchant_aliases")
      .select("merchant_id")
      .eq("user_id", ownerUserId)
      .eq("alias", alias)
      .maybeSingle();
    if (aliasError) {
      throw new Error(
        `Failed to look up merchant alias: ${aliasError.message}`,
      );
    }
    if (aliasRow) {
      const { data, error } = await supabase
        .from("merchants")
        .select("atlas_category_id")
        .eq("id", aliasRow.merchant_id)
        .single();
      if (error || !data) {
        throw new Error(
          `Failed to load merchant ${aliasRow.merchant_id}: ${error?.message ?? "not found"}`,
        );
      }
      return {
        merchantId: aliasRow.merchant_id,
        needsReview: data.atlas_category_id === null,
        outcome: "matched-existing-alias",
      };
    }
  }

  const { data: existingMerchant, error: merchantLookupError } = await supabase
    .from("merchants")
    .select("id, atlas_category_id")
    .eq("user_id", ownerUserId)
    .eq("merchant_name", normalizedText)
    .maybeSingle();
  if (merchantLookupError) {
    throw new Error(
      `Failed to look up merchant: ${merchantLookupError.message}`,
    );
  }

  if (existingMerchant) {
    if (!dryRun) {
      const { error } = await supabase.from("merchant_aliases").insert({
        user_id: ownerUserId,
        merchant_id: existingMerchant.id,
        alias: rawText,
        source_bank: input.sourceBank,
        confidence: 1.0,
      });
      if (error)
        throw new Error(`Failed to save merchant alias: ${error.message}`);
    }
    return {
      merchantId: existingMerchant.id,
      needsReview: existingMerchant.atlas_category_id === null,
      outcome: "matched-existing-by-name",
    };
  }

  if (dryRun) {
    return {
      merchantId: "(would-create-new)",
      needsReview: true,
      outcome: "would-create-new",
    };
  }

  const { data: newMerchant, error: createMerchantError } = await supabase
    .from("merchants")
    .insert({
      user_id: ownerUserId,
      merchant_name: normalizedText,
      display_name: normalizedText,
      default_currency: input.currency,
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

  const { error: aliasInsertError } = await supabase
    .from("merchant_aliases")
    .insert({
      user_id: ownerUserId,
      merchant_id: newMerchant.id,
      alias: rawText,
      source_bank: input.sourceBank,
      confidence: 1.0,
    });
  if (aliasInsertError) {
    throw new Error(
      `Failed to save merchant alias: ${aliasInsertError.message}`,
    );
  }

  return {
    merchantId: newMerchant.id,
    needsReview: true,
    outcome: "created-new",
  };
}

async function main() {
  loadDotEnvLocal();
  const dryRun = process.argv.includes("--dry-run");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ownerUserId = process.env.APP_OWNER_USER_ID;

  if (!url || !serviceRoleKey || !ownerUserId) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or APP_OWNER_USER_ID.\n" +
        "Set them in .env.local, or export them in your shell, then re-run.",
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    db: { schema: "finance" },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(
    dryRun ? "Dry run -- no changes will be written.\n" : "Applying changes.\n",
  );

  const { data: rows, error: rowsError } = await supabase
    .from("credit_card_transactions")
    .select("id, statement_id, merchant_raw, merchant_normalized, currency")
    .eq("user_id", ownerUserId)
    .is("merchant_id", null)
    .not("merchant_raw", "is", null)
    .order("transaction_date")
    .order("sequence_number");

  if (rowsError) {
    console.error(`Failed to load transactions: ${rowsError.message}`);
    process.exit(1);
  }

  if (rows.length === 0) {
    console.log(
      "Nothing to backfill -- every transaction already has a merchant_id, or none has merchant_raw set.",
    );
    return;
  }

  console.log(
    `Found ${rows.length} transaction${rows.length === 1 ? "" : "s"} needing a merchant tag.`,
  );

  const statementIds = [...new Set(rows.map((r) => r.statement_id))];
  const { data: statements, error: statementsError } = await supabase
    .from("credit_card_statements")
    .select("id, issuer, card_type")
    .in("id", statementIds);
  if (statementsError) {
    console.error(`Failed to load statements: ${statementsError.message}`);
    process.exit(1);
  }
  const sourceBankByStatementId = new Map(
    statements.map((s) => [s.id, slugifySourceBank(s.issuer, s.card_type)]),
  );

  // Sequential, not parallel -- same reasoning as
  // resolveMerchantsForImport: two different raw variants of the same
  // merchant appearing across these rows must not race to create the
  // same merchant_name twice.
  const byRawText = new Map();
  for (const row of rows) {
    if (!byRawText.has(row.merchant_raw)) {
      byRawText.set(row.merchant_raw, {
        rawText: row.merchant_raw,
        normalizedText: row.merchant_normalized ?? row.merchant_raw,
        sourceBank: sourceBankByStatementId.get(row.statement_id) ?? "unknown",
        currency: row.currency,
      });
    }
  }

  console.log(
    `(${byRawText.size} unique merchant text${byRawText.size === 1 ? "" : "s"} to resolve)\n`,
  );

  const resolutions = new Map();
  let created = 0;
  let matchedExisting = 0;
  for (const [rawText, input] of byRawText) {
    const resolution = await resolveOneMerchant(
      supabase,
      ownerUserId,
      input,
      dryRun,
    );
    resolutions.set(rawText, resolution);
    if (
      resolution.outcome === "created-new" ||
      resolution.outcome === "would-create-new"
    ) {
      created += 1;
      console.log(
        `  + new merchant: "${input.normalizedText}" (from "${rawText}")`,
      );
    } else {
      matchedExisting += 1;
      console.log(
        `  = matched existing merchant for "${rawText}" -> "${input.normalizedText}"`,
      );
    }
  }

  // Group transaction ids by (merchantId, needsReview) so each distinct
  // combination is one bulk .update(), not one round-trip per row.
  const groups = new Map();
  for (const row of rows) {
    const resolution = resolutions.get(row.merchant_raw);
    const key = `${resolution.merchantId}:${resolution.needsReview}`;
    const group = groups.get(key) ?? {
      merchantId: resolution.merchantId,
      needsReview: resolution.needsReview,
      ids: [],
    };
    group.ids.push(row.id);
    groups.set(key, group);
  }

  let updatedCount = 0;
  if (!dryRun) {
    for (const group of groups.values()) {
      const { error } = await supabase
        .from("credit_card_transactions")
        .update({
          merchant_id: group.merchantId,
          needs_review: group.needsReview,
        })
        .eq("user_id", ownerUserId)
        .in("id", group.ids);
      if (error) {
        throw new Error(
          `Failed to tag ${group.ids.length} transaction(s): ${error.message}`,
        );
      }
      updatedCount += group.ids.length;
    }
  }

  const needsReviewTotal = rows.filter(
    (row) => resolutions.get(row.merchant_raw).needsReview,
  ).length;

  console.log("");
  console.log(
    dryRun
      ? `Would tag ${rows.length} transaction(s) across ${byRawText.size} merchant(s) (${created} new, ${matchedExisting} matched existing). ${needsReviewTotal} would need a category assigned afterward.`
      : `Tagged ${updatedCount} transaction(s) across ${byRawText.size} merchant(s) (${created} new, ${matchedExisting} matched existing). ${needsReviewTotal} need a category -- check /merchants?filter=uncategorized.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
