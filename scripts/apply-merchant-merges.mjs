#!/usr/bin/env node
/**
 * Applies specific, explicitly-listed merchant merges by ID pair —
 * built for confirming a handful of suggestions from
 * scripts/suggest-merchant-merges.mjs one at a time, after a human has
 * actually looked at each one (that script never applies anything
 * itself, on purpose). Mutation logic mirrors MerchantService.
 * mergeMerchants() exactly: reassign every alias and every transaction
 * from source to target, then delete the source merchant row. No
 * confidence threshold, no batch/substring matching (see
 * bulk-merge-merchants.mjs for that) — every pair here was a specific,
 * reviewed decision.
 *
 * Usage:
 *   node scripts/apply-merchant-merges.mjs --pair <sourceId>:<targetId> [--pair ...] [--dry-run]
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
 * APP_OWNER_USER_ID from .env.local (or the environment, if already
 * exported) — same as this repo's other scripts/*.mjs.
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
  const args = { dryRun: false, pairs: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--pair") {
      args.pairs.push(argv[++i]);
    }
  }
  return args;
}

async function main() {
  loadDotEnvLocal();
  const args = parseArgs(process.argv.slice(2));

  if (args.pairs.length === 0) {
    console.error(
      "Usage: node scripts/apply-merchant-merges.mjs --pair <sourceId>:<targetId> [--pair ...] [--dry-run]",
    );
    process.exit(1);
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

  const pairs = args.pairs.map((p) => {
    const [sourceId, targetId] = p.split(":");
    if (!sourceId || !targetId) {
      console.error(`Bad --pair "${p}" -- expected <sourceId>:<targetId>.`);
      process.exit(1);
    }
    return { sourceId, targetId };
  });

  for (const { sourceId, targetId } of pairs) {
    if (sourceId === targetId) {
      console.error(`Skipping ${sourceId}: source and target are the same.`);
      continue;
    }

    const { data: source } = await supabase
      .from("merchants")
      .select("display_name")
      .eq("user_id", ownerUserId)
      .eq("id", sourceId)
      .maybeSingle();
    const { data: target, error: targetError } = await supabase
      .from("merchants")
      .select("display_name, atlas_category_id")
      .eq("user_id", ownerUserId)
      .eq("id", targetId)
      .maybeSingle();

    if (targetError || !target) {
      console.error(
        `  Target ${targetId} not found (${targetError?.message ?? "no row"}) -- skipping this pair.`,
      );
      continue;
    }
    if (!source) {
      console.error(`  Source ${sourceId} not found -- skipping this pair.`);
      continue;
    }

    console.log(`"${source.display_name}" -> "${target.display_name}"`);

    if (args.dryRun) {
      console.log("  (dry run -- not applied)\n");
      continue;
    }

    const { error: aliasError } = await supabase
      .from("merchant_aliases")
      .update({ merchant_id: targetId })
      .eq("user_id", ownerUserId)
      .eq("merchant_id", sourceId);
    if (aliasError) {
      console.error(`  Failed to reassign aliases: ${aliasError.message}`);
      continue;
    }

    const { error: txnError } = await supabase
      .from("credit_card_transactions")
      .update({
        merchant_id: targetId,
        needs_review: target.atlas_category_id === null,
      })
      .eq("user_id", ownerUserId)
      .eq("merchant_id", sourceId);
    if (txnError) {
      console.error(`  Failed to reassign transactions: ${txnError.message}`);
      continue;
    }

    const { error: deleteError } = await supabase
      .from("merchants")
      .delete()
      .eq("user_id", ownerUserId)
      .eq("id", sourceId);
    if (deleteError) {
      console.error(
        `  Failed to remove source merchant: ${deleteError.message}`,
      );
      continue;
    }

    console.log("  merged.\n");
  }

  console.log(args.dryRun ? "Dry run complete." : "Done.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
