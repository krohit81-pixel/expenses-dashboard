#!/usr/bin/env node
/**
 * Merges every merchant whose name matches a substring into ONE
 * canonical merchant, then categorizes that single result -- the
 * consolidating counterpart to scripts/bulk-tag-merchants.mjs (which
 * tags matching merchants in place but leaves them as separate rows).
 *
 * Built for the same root cause: the pre-v1.5.3 HDFC Infinia parser
 * treated every IGST tax line as its own brand-new merchant, since each
 * carries a unique reference number in its description. Tagging all of
 * them still leaves 100+ separate rows in /merchants, all pointing at
 * the same category -- this instead collapses them into one merchant
 * (creating it fresh if it doesn't already exist), moving every alias
 * and every transaction over, and deleting the rest. Mirrors
 * MerchantService.mergeMerchants's reassignment logic exactly (see that
 * function's own comments), just generalized from one source to N.
 *
 * Usage:
 *   node scripts/bulk-merge-merchants.mjs --match "igst-vps" --canonical-name "FX Charges" --category "Fees & Charges" --merchant-type "FX Charges" --dry-run
 *   node scripts/bulk-merge-merchants.mjs --match "igst-vps" --canonical-name "FX Charges" --category "Fees & Charges" --merchant-type "FX Charges"
 *
 * Flags:
 *   --match <substring>          required. Case-insensitive, matched via ILIKE against merchant_name OR display_name.
 *   --canonical-name <name>      required. The single merchant all matches collapse into. Reused as an existing merchant if one already has this exact name (case-insensitive); created fresh otherwise.
 *   --category <name>            required. Exact atlas_categories.category_name (top-level or subcategory), case-insensitive. Applied to the canonical merchant.
 *   --merchant-type <value>      optional. Sets the canonical merchant's merchant_type.
 *   --dry-run                    optional. Preview what would happen; writes nothing.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
 * APP_OWNER_USER_ID from .env.local (or the environment, if already
 * exported) -- same as this repo's other scripts/*.mjs.
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

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--match") {
      args.match = argv[++i];
    } else if (arg === "--canonical-name") {
      args.canonicalName = argv[++i];
    } else if (arg === "--category") {
      args.category = argv[++i];
    } else if (arg === "--merchant-type") {
      args.merchantType = argv[++i];
    }
  }
  return args;
}

function printUsageAndExit() {
  console.error(
    "Usage: node scripts/bulk-merge-merchants.mjs --match <substring> --canonical-name <name> --category <name> [--merchant-type <value>] [--dry-run]",
  );
  process.exit(1);
}

async function main() {
  loadDotEnvLocal();
  const args = parseArgs(process.argv.slice(2));

  if (!args.match || !args.canonicalName || !args.category) {
    printUsageAndExit();
  }

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
    args.dryRun
      ? "Dry run -- no changes will be written.\n"
      : "Applying changes.\n",
  );

  // Resolve the target category by exact name, case-insensitively.
  const { data: categories, error: categoryError } = await supabase
    .from("atlas_categories")
    .select("id, category_name, parent_category_id")
    .eq("user_id", ownerUserId)
    .ilike("category_name", args.category);

  if (categoryError) {
    console.error(`Failed to look up category: ${categoryError.message}`);
    process.exit(1);
  }
  if (categories.length === 0) {
    console.error(
      `No category named "${args.category}" found. Check /merchants (or run scripts/seed-atlas-categories.mjs) and try again.`,
    );
    process.exit(1);
  }
  if (categories.length > 1) {
    console.error(
      `Multiple categories match "${args.category}" -- be more specific:\n` +
        categories.map((c) => `  - ${c.category_name}`).join("\n"),
    );
    process.exit(1);
  }
  const category = categories[0];
  const isSubcategory = category.parent_category_id !== null;

  // Every merchant matching the substring, oldest first -- if the
  // canonical name happens to already be one of them, it's kept as the
  // target rather than duplicated (see below).
  const { data: matches, error: matchesError } = await supabase
    .from("merchants")
    .select(
      "id, merchant_name, display_name, default_currency, atlas_category_id, merchant_type",
    )
    .eq("user_id", ownerUserId)
    .or(
      `merchant_name.ilike.%${args.match}%,display_name.ilike.%${args.match}%`,
    )
    .order("created_at");

  if (matchesError) {
    console.error(`Failed to look up merchants: ${matchesError.message}`);
    process.exit(1);
  }

  if (matches.length === 0) {
    console.log(`No merchants match "${args.match}" -- nothing to do.`);
    return;
  }

  console.log(
    `Found ${matches.length} merchant${matches.length === 1 ? "" : "s"} matching "${args.match}".`,
  );

  // If one of the matches is already named exactly --canonical-name,
  // reuse it as the merge target instead of creating a new merchant and
  // then immediately merging that one into it too.
  const existingCanonical = matches.find(
    (m) => m.display_name.toLowerCase() === args.canonicalName.toLowerCase(),
  );
  const sources = existingCanonical
    ? matches.filter((m) => m.id !== existingCanonical.id)
    : matches;

  console.log(
    existingCanonical
      ? `Reusing existing merchant "${existingCanonical.display_name}" as the canonical merchant.`
      : `Will create a new merchant "${args.canonicalName}" as the canonical merchant.`,
  );
  console.log(
    `${sources.length} merchant${sources.length === 1 ? "" : "s"} will be merged into it and deleted:\n`,
  );
  for (const m of sources) {
    console.log(`  - ${m.display_name}`);
  }
  console.log(
    `\nCanonical merchant will end up with category = "${category.category_name}"${
      args.merchantType ? `, merchant_type = "${args.merchantType}"` : ""
    }.\n`,
  );

  if (args.dryRun) {
    console.log("Dry run complete -- nothing written.");
    return;
  }

  let canonicalId = existingCanonical?.id;
  if (!canonicalId) {
    const categoryFields = isSubcategory
      ? { atlas_subcategory_id: category.id }
      : { atlas_category_id: category.id };
    const { data: created, error: createError } = await supabase
      .from("merchants")
      .insert({
        user_id: ownerUserId,
        merchant_name: args.canonicalName,
        display_name: args.canonicalName,
        default_currency: matches[0]?.default_currency ?? "INR",
        merchant_type: args.merchantType ?? null,
        confidence: 1.0,
        active: true,
        ...categoryFields,
      })
      .select("id")
      .single();
    if (createError || !created) {
      console.error(
        `Failed to create canonical merchant: ${createError?.message ?? "unknown error"}`,
      );
      process.exit(1);
    }
    canonicalId = created.id;
    console.log(`Created canonical merchant "${args.canonicalName}".`);
  }

  // Sequential, not parallel -- reassigning N sources into one target
  // one at a time avoids any ambiguity about partial failure part-way
  // through (same spirit as MerchantDictionaryService's sequential
  // resolution, though the race this guards against is different: here
  // it's just "know exactly how far we got if one merchant fails").
  let mergedCount = 0;
  for (const source of sources) {
    const { error: aliasError } = await supabase
      .from("merchant_aliases")
      .update({ merchant_id: canonicalId })
      .eq("user_id", ownerUserId)
      .eq("merchant_id", source.id);
    if (aliasError) {
      console.error(
        `Failed to reassign aliases for "${source.display_name}": ${aliasError.message}`,
      );
      process.exit(1);
    }

    const { error: txnError } = await supabase
      .from("credit_card_transactions")
      .update({ merchant_id: canonicalId, needs_review: false })
      .eq("user_id", ownerUserId)
      .eq("merchant_id", source.id);
    if (txnError) {
      console.error(
        `Failed to reassign transactions for "${source.display_name}": ${txnError.message}`,
      );
      process.exit(1);
    }

    const { error: deleteError } = await supabase
      .from("merchants")
      .delete()
      .eq("user_id", ownerUserId)
      .eq("id", source.id);
    if (deleteError) {
      console.error(
        `Failed to remove merged merchant "${source.display_name}": ${deleteError.message}`,
      );
      process.exit(1);
    }

    mergedCount += 1;
    console.log(`  merged and removed "${source.display_name}"`);
  }

  // Set/refresh the canonical merchant's category and merchant_type
  // regardless of whether it was just created or already existed --
  // ensures the end state matches what was asked for either way.
  const categoryFields = isSubcategory
    ? { atlas_subcategory_id: category.id }
    : { atlas_category_id: category.id };
  const finalUpdate = { ...categoryFields };
  if (args.merchantType !== undefined)
    finalUpdate.merchant_type = args.merchantType;

  const { error: finalUpdateError } = await supabase
    .from("merchants")
    .update(finalUpdate)
    .eq("user_id", ownerUserId)
    .eq("id", canonicalId);
  if (finalUpdateError) {
    console.error(
      `Merged everything, but failed to set the canonical merchant's category: ${finalUpdateError.message}`,
    );
    process.exit(1);
  }

  const { error: reviewError } = await supabase
    .from("credit_card_transactions")
    .update({ needs_review: false })
    .eq("user_id", ownerUserId)
    .eq("merchant_id", canonicalId)
    .eq("needs_review", true);
  if (reviewError) {
    console.error(
      `Merged everything, but failed to clear the canonical merchant's review flag: ${reviewError.message}`,
    );
    process.exit(1);
  }

  console.log(
    `\nDone. Merged ${mergedCount} merchant(s) into "${args.canonicalName}", categorized as "${category.category_name}"${
      args.merchantType ? ` / "${args.merchantType}"` : ""
    }.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
