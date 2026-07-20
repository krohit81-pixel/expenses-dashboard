#!/usr/bin/env node
/**
 * Bulk-tags every merchant whose name matches a substring with a given
 * category (and, optionally, a merchant_type label) in one go -- for
 * cleaning up a batch of similar merchants at once instead of clicking
 * through /merchants one at a time. Built for exactly this case: the
 * pre-v1.5.3 HDFC Infinia parser (see git log for that release) treated
 * every IGST tax line as its own brand-new merchant, since each one
 * carries a unique reference number in its description -- so a heavy
 * international statement can leave dozens of merchants named things
 * like "Igst-vps2713836341577-rate 18.0 -27 (ref# vt261380075024430000101)"
 * sitting uncategorized. This tags all of them at once rather than
 * requiring 100+ individual edits in the UI.
 *
 * Matches case-insensitively against BOTH merchant_name and display_name
 * (whichever normalizeMerchant/the user happened to set), and mirrors
 * MerchantService.updateMerchant's one deliberate side effect: assigning
 * a category also clears needs_review on every transaction that
 * currently has it set for an affected merchant (see that function's own
 * comment for why needs_review is the one flag stored rather than
 * derived, and so needs this explicit transition).
 *
 * Usage:
 *   node scripts/bulk-tag-merchants.mjs --match "igst-vps" --category "Fees & Charges" --merchant-type "FX Charges"
 *   node scripts/bulk-tag-merchants.mjs --match "igst-vps" --category "Fees & Charges" --merchant-type "FX Charges" --dry-run
 *
 * Flags:
 *   --match <substring>        required. Case-insensitive, matched via ILIKE against merchant_name OR display_name.
 *   --category <name>          required. Exact atlas_categories.category_name (top-level or subcategory), case-insensitive.
 *   --merchant-type <value>    optional. Sets merchants.merchant_type. Omit to leave merchant_type untouched.
 *   --dry-run                  optional. Preview matched merchants and counts; writes nothing.
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
    "Usage: node scripts/bulk-tag-merchants.mjs --match <substring> --category <name> [--merchant-type <value>] [--dry-run]",
  );
  process.exit(1);
}

async function main() {
  loadDotEnvLocal();
  const args = parseArgs(process.argv.slice(2));

  if (!args.match || !args.category) {
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

  // Resolve the target category by exact name, case-insensitively --
  // could be top-level or a subcategory, so no parent_category_id filter.
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

  // Match against merchant_name OR display_name -- normalizeMerchant's
  // title-casing means the exact case varies, hence ilike, not eq.
  const { data: merchants, error: merchantsError } = await supabase
    .from("merchants")
    .select("id, merchant_name, display_name, atlas_category_id, merchant_type")
    .eq("user_id", ownerUserId)
    .or(
      `merchant_name.ilike.%${args.match}%,display_name.ilike.%${args.match}%`,
    );

  if (merchantsError) {
    console.error(`Failed to look up merchants: ${merchantsError.message}`);
    process.exit(1);
  }

  if (merchants.length === 0) {
    console.log(`No merchants match "${args.match}" -- nothing to do.`);
    return;
  }

  console.log(
    `Found ${merchants.length} merchant${merchants.length === 1 ? "" : "s"} matching "${args.match}":\n`,
  );
  for (const m of merchants) {
    console.log(`  - ${m.display_name}`);
  }
  console.log(
    `\n${args.dryRun ? "Would set" : "Setting"} category = "${category.category_name}"${
      args.merchantType ? `, merchant_type = "${args.merchantType}"` : ""
    } on all ${merchants.length} of them.\n`,
  );

  if (args.dryRun) {
    console.log("Dry run complete -- nothing written.");
    return;
  }

  const merchantIds = merchants.map((m) => m.id);

  const update = isSubcategory
    ? { atlas_subcategory_id: category.id }
    : { atlas_category_id: category.id };
  if (args.merchantType !== undefined) update.merchant_type = args.merchantType;

  const { error: updateError } = await supabase
    .from("merchants")
    .update(update)
    .eq("user_id", ownerUserId)
    .in("id", merchantIds);

  if (updateError) {
    console.error(`Failed to update merchants: ${updateError.message}`);
    process.exit(1);
  }

  // Same deliberate side effect as MerchantService.updateMerchant: assigning
  // a category clears needs_review on that merchant's transactions.
  const { error: reviewError, count } = await supabase
    .from("credit_card_transactions")
    .update({ needs_review: false }, { count: "exact" })
    .eq("user_id", ownerUserId)
    .in("merchant_id", merchantIds)
    .eq("needs_review", true);

  if (reviewError) {
    console.error(
      `Merchants were tagged, but failed to clear their transactions' review flag: ${reviewError.message}`,
    );
    process.exit(1);
  }

  console.log(
    `Tagged ${merchants.length} merchant(s) with "${category.category_name}"${
      args.merchantType ? ` / "${args.merchantType}"` : ""
    }. Cleared needs_review on ${count ?? 0} transaction(s).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
