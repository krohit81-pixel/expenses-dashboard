import "server-only";

import { callConfiguredProvider } from "@/lib/ai/providers";
import {
  listMerchants,
  type MerchantSummary,
} from "@/services/MerchantService";

/**
 * The deterministic Merchant Dictionary match (MerchantDictionaryService's
 * resolveOneMerchant) only ever does exact alias/name matches — its own
 * comment calls out "no LLM, no fuzzy matching yet" as a deliberately
 * deferred step. That means a merchant whose raw statement text is even
 * slightly different from anything seen before (an order-ID suffix, a
 * city name, a punctuation change) always creates a brand-new
 * "unmapped" merchant row rather than being recognized as one already
 * known — the household's own report: "I see a lot of unmapped ones
 * present" after an import.
 *
 * v2.5.5: this is that deferred step, scoped narrowly and safely. The
 * LLM's job is ADVISORY ONLY — it proposes candidate (unmapped,
 * established) pairs it's confident name the same real-world merchant;
 * nothing here writes to the database. Actually merging still goes
 * through the exact same mergeMerchants() a human uses from a
 * merchant's own detail page (see MergeMerchantForm) — this only
 * narrows down which pairs are worth a human's one click, same
 * "explicit review over destructive automation" principle every other
 * statement-import step in this app already follows (see docs/00's
 * architecture principles). Consistent with docs/07-ai-assistant.md's
 * existing guardrails: only merchant *names* (not amounts, dates, card
 * numbers, or any other transaction detail) ever reach the prompt.
 */

const MAX_UNMAPPED_IN_PROMPT = 100;
const MAX_ESTABLISHED_IN_PROMPT = 300;
/** Structured JSON output for up to MAX_UNMAPPED_IN_PROMPT suggestions needs more room than the ~300-token Intel insight paragraph. */
const MAX_OUTPUT_TOKENS = 2000;

export interface MergeSuggestion {
  sourceMerchantId: string;
  sourceName: string;
  targetMerchantId: string;
  targetName: string;
  confidence: "high" | "medium";
  reason: string;
}

export type SuggestMergesResult =
  { ok: true; suggestions: MergeSuggestion[] } | { ok: false; reason: string };

function byTransactionCountDesc(a: MerchantSummary, b: MerchantSummary) {
  return b.transactionCount - a.transactionCount;
}

/**
 * "Unmapped" mirrors exactly what the rest of the app already calls
 * needing review (MerchantsPage's uncategorizedCount,
 * StatementUploadForm's needsReviewCount): atlas_category_id null.
 * "Established" is everything else — already reviewed and given a real
 * category, so confident enough to be a merge *target*. Deactivated
 * merchants are excluded from both sides; there's nothing useful to
 * suggest about a merchant the household has already chosen to hide.
 *
 * Exported for direct testing — pure, no I/O, same reasoning as every
 * other pure helper in this codebase (cycleMonthForStatementDate,
 * guessCardAccountId, etc.) being tested directly rather than through
 * the server-only function that calls it.
 */
export function splitCandidates(merchants: MerchantSummary[]) {
  const active = merchants.filter((m) => m.active);
  const unmapped = active
    .filter((m) => m.atlasCategoryId === null)
    .sort(byTransactionCountDesc)
    .slice(0, MAX_UNMAPPED_IN_PROMPT);
  const established = active
    .filter((m) => m.atlasCategoryId !== null)
    .sort(byTransactionCountDesc)
    .slice(0, MAX_ESTABLISHED_IN_PROMPT);
  return { unmapped, established };
}

function buildPrompt(
  unmapped: MerchantSummary[],
  established: MerchantSummary[],
): string {
  const unmappedLines = unmapped
    .map((m, i) => `${i + 1}. ${m.displayName}`)
    .join("\n");
  const establishedLines = established
    .map((m, i) => `${i + 1}. ${m.displayName}`)
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

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

interface RawSuggestion {
  newIndex?: unknown;
  establishedIndex?: unknown;
  confidence?: unknown;
  reason?: unknown;
}

/**
 * Defensive by design -- this is parsing free-text model output, not a
 * typed API response. Any single malformed entry is dropped rather than
 * failing the whole batch; a completely unparseable response yields an
 * empty suggestion list (never an error) since "the AI didn't have
 * anything confident to say" and "the AI's output was junk" should look
 * the same to the person using this button -- either way, nothing was
 * found worth reviewing right now.
 */
export function parseSuggestions(
  responseText: string,
  unmapped: MerchantSummary[],
  established: MerchantSummary[],
): MergeSuggestion[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(responseText));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const suggestions = new Map<string, MergeSuggestion>();
  for (const entry of parsed as RawSuggestion[]) {
    if (typeof entry !== "object" || entry === null) continue;
    const { newIndex, establishedIndex, confidence, reason } = entry;
    if (typeof newIndex !== "number" || typeof establishedIndex !== "number") {
      continue;
    }
    const source = unmapped[newIndex - 1];
    const target = established[establishedIndex - 1];
    if (!source || !target) continue;
    if (confidence !== "high" && confidence !== "medium") continue;

    // Keep the first (highest-ranked, since the model was asked to list
    // its best matches) suggestion per source merchant if it somehow
    // names the same one twice.
    if (suggestions.has(source.id)) continue;

    suggestions.set(source.id, {
      sourceMerchantId: source.id,
      sourceName: source.displayName,
      targetMerchantId: target.id,
      targetName: target.displayName,
      confidence,
      reason: typeof reason === "string" ? reason.slice(0, 200) : "",
    });
  }
  return Array.from(suggestions.values());
}

/**
 * Button-triggered (never automatic — see MerchantMergeSuggestions),
 * same as Intel's insight. Returns `{ ok: true, suggestions: [] }`
 * rather than an error when there's simply nothing to check (no
 * unmapped merchants, or no established ones to match against) — that's
 * a normal, good state, not a failure.
 */
export async function suggestMerchantMerges(): Promise<SuggestMergesResult> {
  const merchants = await listMerchants();
  const { unmapped, established } = splitCandidates(merchants);

  if (unmapped.length === 0 || established.length === 0) {
    return { ok: true, suggestions: [] };
  }

  const prompt = buildPrompt(unmapped, established);

  let responseText: string | null;
  try {
    responseText = await callConfiguredProvider(prompt, MAX_OUTPUT_TOKENS);
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error
          ? `Something went wrong asking the AI for suggestions: ${error.message}`
          : "Something went wrong asking the AI for suggestions.",
    };
  }

  if (responseText === null) {
    return {
      ok: false,
      reason:
        "No AI provider is configured — set ANTHROPIC_API_KEY or GEMINI_API_KEY.",
    };
  }

  return {
    ok: true,
    suggestions: parseSuggestions(responseText, unmapped, established),
  };
}
