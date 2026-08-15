#!/usr/bin/env node
/**
 * One-time (or run-whenever) backlog sweep: reports which "unmapped"
 * merchants (atlas_category_id null) are probably an already-categorized
 * ("established") merchant under different wording — an order-ID
 * suffix, a city name, an abbreviation — the exact gap
 * MerchantDictionaryService's deterministic resolver leaves (it only
 * ever matches EXACT alias/name text). Same suggestion logic as
 * src/services/MerchantMergeSuggestionService.ts (the "Find likely
 * duplicates" button on /merchants and on a successful statement
 * import), reimplemented here in plain JS against the real DB directly
 * — same reasoning as this repo's other scripts/*.mjs not reusing the
 * TS service layer (no build step needed to run a one-off script).
 *
 * REPORT ONLY — never writes anything. Applying a suggested merge still
 * goes through the app itself (the "Merge" button on /merchants or on
 * an import's summary), one confirmed click at a time, same as every
 * other merge in this app. This script exists to let the AI check the
 * *entire* backlog in one pass without needing to click "Find likely
 * duplicates" from the UI repeatedly for a large existing backlog.
 *
 * Usage:
 *   node scripts/suggest-merchant-merges.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * APP_OWNER_USER_ID, and (ANTHROPIC_API_KEY or GEMINI_API_KEY) from
 * .env.local (or the environment, if already exported) — same as this
 * repo's other scripts/*.mjs.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const MAX_UNMAPPED = 300;
const MAX_ESTABLISHED = 500;
const ANTHROPIC_MODEL = "claude-sonnet-5";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

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

async function callAnthropic(apiKey, prompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Anthropic API returned ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }
  const data = await response.json();
  return data.content.find((b) => b.type === "text")?.text?.trim() ?? null;
}

async function callGemini(apiKey, model, prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2000 },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Gemini API returned ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
}

function buildPrompt(unmapped, established) {
  const unmappedLines = unmapped
    .map((m, i) => `${i + 1}. ${m.display_name}`)
    .join("\n");
  const establishedLines = established
    .map((m, i) => `${i + 1}. ${m.display_name}`)
    .join("\n");

  return `You are deduplicating a personal expense-tracking merchant dictionary. Two numbered lists follow: ESTABLISHED merchants (already reviewed and categorized) and NEW merchants (need reviewing).

For each NEW merchant you are CONFIDENT refers to the exact same real-world business as one specific ESTABLISHED merchant -- just written differently (an order/reference-number suffix, a city or branch name, an abbreviation, extra punctuation) -- report a match. Skip anything you are not confident about, and skip anything that might be a genuinely different business even if the names look similar (a different restaurant, a different subsidiary of the same brand, a different branch that bills separately). A missed match is fine; a wrong merge is not, so err toward skipping.

ESTABLISHED merchants:
${establishedLines || "(none yet)"}

NEW merchants:
${unmappedLines}

Respond with ONLY a JSON array, no markdown formatting and no commentary before or after it. Each element must look exactly like this:
{"newIndex": 2, "establishedIndex": 5, "confidence": "high", "reason": "short reason"}

"newIndex" and "establishedIndex" are the 1-based numbers from the lists above. "confidence" must be exactly "high" or "medium". If there are no confident matches, respond with exactly: []`;
}

function stripCodeFence(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function parseSuggestions(responseText, unmapped, established) {
  let parsed;
  try {
    parsed = JSON.parse(stripCodeFence(responseText));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const seen = new Map();
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const { newIndex, establishedIndex, confidence, reason } = entry;
    if (typeof newIndex !== "number" || typeof establishedIndex !== "number")
      continue;
    const source = unmapped[newIndex - 1];
    const target = established[establishedIndex - 1];
    if (!source || !target) continue;
    if (confidence !== "high" && confidence !== "medium") continue;
    if (seen.has(source.id)) continue;
    seen.set(source.id, {
      sourceId: source.id,
      sourceName: source.display_name,
      targetId: target.id,
      targetName: target.display_name,
      confidence,
      reason: typeof reason === "string" ? reason.slice(0, 200) : "",
    });
  }
  return Array.from(seen.values());
}

async function main() {
  loadDotEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ownerUserId = process.env.APP_OWNER_USER_ID;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

  if (!url || !serviceRoleKey || !ownerUserId) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or APP_OWNER_USER_ID.\n" +
        "Set them in .env.local, or export them in your shell, then re-run.",
    );
    process.exit(1);
  }
  if (!anthropicKey && !geminiKey) {
    console.error(
      "No AI provider configured -- set ANTHROPIC_API_KEY or GEMINI_API_KEY.",
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    db: { schema: "finance" },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: merchants, error } = await supabase
    .from("merchants")
    .select("id, display_name, atlas_category_id, active, created_at")
    .eq("user_id", ownerUserId)
    .eq("active", true);

  if (error) {
    console.error(`Failed to load merchants: ${error.message}`);
    process.exit(1);
  }

  const unmapped = merchants
    .filter((m) => m.atlas_category_id === null)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, MAX_UNMAPPED);
  const established = merchants
    .filter((m) => m.atlas_category_id !== null)
    .slice(0, MAX_ESTABLISHED);

  console.log(
    `${unmapped.length} unmapped merchant(s), ${established.length} established merchant(s) to check against.\n`,
  );

  if (unmapped.length === 0) {
    console.log("Nothing unmapped -- nothing to do.");
    return;
  }
  if (established.length === 0) {
    console.log(
      "No established (categorized) merchants to match against -- nothing to do.",
    );
    return;
  }

  const prompt = buildPrompt(unmapped, established);
  console.log(
    `Asking ${anthropicKey ? "Anthropic" : "Gemini"}... (this can take a few seconds)\n`,
  );

  const responseText = anthropicKey
    ? await callAnthropic(anthropicKey, prompt)
    : await callGemini(geminiKey, geminiModel, prompt);

  if (!responseText) {
    console.log("The model returned an empty response -- nothing to report.");
    return;
  }

  const suggestions = parseSuggestions(responseText, unmapped, established);

  if (suggestions.length === 0) {
    console.log("No confident duplicates found in this pass.");
    if (unmapped.length === MAX_UNMAPPED) {
      console.log(
        `(Checked the oldest ${MAX_UNMAPPED} unmapped merchants only -- re-run after merging/categorizing some to check further back.)`,
      );
    }
    return;
  }

  console.log(`${suggestions.length} suggested merge(s):\n`);
  for (const s of suggestions) {
    console.log(
      `  [${s.confidence.toUpperCase()}] "${s.sourceName}" -> "${s.targetName}"`,
    );
    console.log(`      ${s.reason}`);
    console.log(`      source id: ${s.sourceId}  target id: ${s.targetId}\n`);
  }
  console.log(
    "Nothing was changed -- this is a report only. Apply any of these from /merchants " +
      "(or the same prompt after your next statement import), or ask to have specific ones applied.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
