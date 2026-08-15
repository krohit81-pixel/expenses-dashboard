import "server-only";

import { serverEnv } from "@/lib/env/server";

/**
 * The two optional, mutually-substitutable LLM providers this app knows
 * about — extracted out of IntelService.ts (v2.5.5) so a second
 * AI-backed feature (MerchantMergeSuggestionService's duplicate-merchant
 * suggestions) doesn't have to re-implement the same two fetch calls and
 * provider-selection order. IntelService's own insight generation is the
 * original caller and stays the reference for expected behavior; see
 * docs/07-ai-assistant.md for the guardrails both features share.
 */
const ANTHROPIC_MODEL = "claude-sonnet-5";
/** Only used when GEMINI_API_KEY is configured and GEMINI_MODEL isn't set — a current, small/cheap chat model. Override via GEMINI_MODEL if this ever starts returning a model-not-found error (model names/versions do change over time — verify against https://ai.google.dev/gemini-api/docs/models). */
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export async function callAnthropic(
  apiKey: string,
  prompt: string,
  maxTokens = 300,
): Promise<string | null> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Anthropic API returned ${response.status}: ${body.slice(0, 300)}`,
    );
  }

  const data: { content: { type: string; text?: string }[] } =
    await response.json();
  const text = data.content.find((block) => block.type === "text")?.text;
  return text?.trim() || null;
}

/** Google's Generative Language API — generateContent, the standard single-turn text-completion endpoint. The API key goes in the query string (Google's documented approach for this API), not a header. */
export async function callGemini(
  apiKey: string,
  prompt: string,
  maxTokens = 300,
): Promise<string | null> {
  const model = serverEnv.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Gemini API returned ${response.status}: ${body.slice(0, 300)}`,
    );
  }

  const data: {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  } = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return text?.trim() || null;
}

export function hasAiProviderConfigured(): boolean {
  return Boolean(serverEnv.ANTHROPIC_API_KEY || serverEnv.GEMINI_API_KEY);
}

/**
 * Runs `prompt` against whichever provider is configured, Anthropic
 * first if both are (arbitrary as a technical matter, but keeps
 * behavior unchanged for the household that's already been running on
 * Anthropic since the original Intel insight feature shipped, rather
 * than silently switching providers out from under them the moment a
 * second key happens to be present — see IntelService's original
 * comment on this, preserved here since it now applies to every
 * caller, not just Intel). Returns null, not an error, if neither key
 * is configured — every caller treats the whole feature as an optional
 * enhancement, same as the original Intel insight.
 */
export async function callConfiguredProvider(
  prompt: string,
  maxTokens = 300,
): Promise<string | null> {
  const anthropicKey = serverEnv.ANTHROPIC_API_KEY;
  const geminiKey = serverEnv.GEMINI_API_KEY;
  if (!anthropicKey && !geminiKey) {
    return null;
  }
  if (anthropicKey) {
    return callAnthropic(anthropicKey, prompt, maxTokens);
  }
  return callGemini(geminiKey as string, prompt, maxTokens);
}
