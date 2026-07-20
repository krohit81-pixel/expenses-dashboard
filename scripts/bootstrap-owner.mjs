#!/usr/bin/env node
/**
 * Creates the single fixed "owner" account this app runs every request as
 * (see src/lib/owner.ts and src/middleware.ts). Run this ONCE per Supabase
 * project — not per deploy, not per environment switch. It prints a UUID;
 * put that in APP_OWNER_USER_ID (locally in .env.local, and in Vercel's
 * project env vars) and you're done. There is no password to remember —
 * one gets generated and discarded, since nothing ever signs in with it
 * again.
 *
 * Usage:
 *   node scripts/bootstrap-owner.mjs you@example.com
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from
 * .env.local (or the environment, if already exported).
 */
import { randomBytes } from "node:crypto";
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

async function main() {
  loadDotEnvLocal();

  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node scripts/bootstrap-owner.mjs you@example.com");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Set them in .env.local, or export them in your shell, then re-run.",
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const throwawayPassword = randomBytes(24).toString("base64url");

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: throwawayPassword,
    email_confirm: true,
  });

  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      console.error(
        `A user with email ${email} already exists.\n` +
          "Find their ID in Supabase → Authentication → Users, and use that " +
          "for APP_OWNER_USER_ID — don't run this script again for the same email.",
      );
      process.exit(1);
    }
    console.error(`Failed to create owner account: ${error.message}`);
    process.exit(1);
  }

  console.log("\nOwner account created.\n");
  console.log(`APP_OWNER_USER_ID=${data.user.id}\n`);
  console.log(
    "Add that to .env.local and to your Vercel project's environment variables, then redeploy.",
  );
}

main();
