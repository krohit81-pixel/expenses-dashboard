#!/usr/bin/env node
/**
 * Seeds the 22 top-level Merchant Dictionary categories (see
 * supabase/migrations/20260722000100_create_merchant_dictionary.sql)
 * for the app's single owner account. Run this ONCE per Supabase
 * project, after applying that migration and after
 * scripts/bootstrap-owner.mjs — same reasoning as bootstrap-owner.mjs
 * itself: this needs a real user_id, and finance.atlas_categories has
 * no default data of its own because the owner's UUID is only known
 * per-deployment, not at migration-authoring time.
 *
 * Idempotent — safe to re-run. Existing top-level categories (matched
 * by name) are left untouched; only missing ones are inserted, so
 * re-running after manually renaming or deactivating one won't undo
 * that.
 *
 * Usage:
 *   node scripts/seed-atlas-categories.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
 * APP_OWNER_USER_ID from .env.local (or the environment, if already
 * exported).
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
    // .env.local not present — fine if the vars are already exported.
  }
}

// Order matches the v1.5 spec's initial category list exactly; icons
// are lucide-react component names (PascalCase, as exported from
// "lucide-react") so a future UI can render them directly without a
// second lookup table.
const CATEGORIES = [
  ["Food & Dining", "UtensilsCrossed"],
  ["Groceries", "ShoppingCart"],
  ["Shopping", "ShoppingBag"],
  ["Travel", "Plane"],
  ["Fuel", "Fuel"],
  ["Utilities", "Plug"],
  ["Housing", "Home"],
  ["Healthcare", "Stethoscope"],
  ["Education", "GraduationCap"],
  ["Entertainment", "Clapperboard"],
  ["Subscriptions", "Repeat"],
  ["Insurance", "ShieldCheck"],
  ["Taxes", "Landmark"],
  ["Investments", "TrendingUp"],
  ["Cash Withdrawal", "Banknote"],
  ["Fees & Charges", "ReceiptText"],
  ["Transfers", "ArrowLeftRight"],
  ["Income", "Wallet"],
  ["Pets", "PawPrint"],
  ["Beauty & Personal Care", "Sparkles"],
  ["Electronics", "Laptop"],
  ["Miscellaneous", "MoreHorizontal"],
];

async function main() {
  loadDotEnvLocal();

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

  const admin = createClient(url, serviceRoleKey, {
    db: { schema: "finance" },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing, error: fetchError } = await admin
    .from("atlas_categories")
    .select("category_name")
    .eq("user_id", ownerUserId)
    .is("parent_category_id", null);

  if (fetchError) {
    console.error(`Failed to check existing categories: ${fetchError.message}`);
    process.exit(1);
  }

  const existingNames = new Set(existing.map((row) => row.category_name));
  const toInsert = CATEGORIES.filter(([name]) => !existingNames.has(name)).map(
    ([category_name, icon], index) => ({
      user_id: ownerUserId,
      category_name,
      icon,
      display_order: index,
    }),
  );

  if (toInsert.length === 0) {
    console.log("All 22 categories already exist — nothing to do.");
    return;
  }

  const { error: insertError } = await admin
    .from("atlas_categories")
    .insert(toInsert);

  if (insertError) {
    console.error(`Failed to insert categories: ${insertError.message}`);
    process.exit(1);
  }

  console.log(
    `Inserted ${toInsert.length} categor${toInsert.length === 1 ? "y" : "ies"}: ${toInsert.map((c) => c.category_name).join(", ")}`,
  );
  if (existingNames.size > 0) {
    console.log(`(${existingNames.size} already existed, left untouched.)`);
  }
}

main();
