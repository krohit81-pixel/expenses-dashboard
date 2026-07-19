import "server-only";

import { formatMoneyDisplay } from "@/lib/money";
import { serverEnv } from "@/lib/env/server";
import {
  getCashFlowSummary,
  getMonthlyExpenditureTrend,
} from "@/services/ReportingService";
import { listTransactions } from "@/services/TransactionService";
import { listCategories } from "@/services/CategoryService";
import { getUserSettings } from "@/services/UserSettingsService";
import { OWNER_USER_ID } from "@/lib/owner";

const ANTHROPIC_MODEL = "claude-sonnet-5";
/** Only used when OPENAI_API_KEY is configured and OPENAI_MODEL isn't set — a current, small/cheap chat model, not GPT-4-class, since this is a 2-3 sentence summary, not a task that needs a frontier model. Override via OPENAI_MODEL if this ever starts returning a model-not-found error (model names/versions do change over time — verify against https://platform.openai.com/docs/models). */
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

/**
 * Builds the same prompt regardless of which provider ends up answering
 * it — the two providers are an implementation detail of *how* the
 * insight gets generated, not a reason for the household's data or the
 * instructions given about it to differ.
 */
function buildInsightPrompt(params: {
  monthStart: string;
  today: string;
  currency: string;
  categoryLines: string;
  trendLines: string;
  upcomingLines: string;
  totalIncome: string;
  totalExpense: string;
  net: string;
}): string {
  return `You are a calm, factual personal finance assistant. Given this household's data for the current month, write a short insight: 2-3 sentences, no more. Point out one genuinely notable pattern (spending trend, category standing out, or an upcoming commitment worth being aware of) and be specific with numbers. Do not give generic advice like "consider budgeting." Do not use markdown formatting.

Current month so far (${params.monthStart} to ${params.today}):
- Income: ${params.totalIncome}
- Expenses: ${params.totalExpense}
- Net: ${params.net}

Expenses by category:
${params.categoryLines || "(none yet this month)"}

Expenditure trend, last 6 months:
${params.trendLines}

Upcoming one-time commitments, next 90 days:
${params.upcomingLines || "(none scheduled)"}`;
}

async function callAnthropic(
  apiKey: string,
  prompt: string,
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
      max_tokens: 300,
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

/** OpenAI's Chat Completions API — the older, more universally-supported endpoint (vs. the newer Responses API), which is enough for a single plain-text completion like this. */
async function callOpenAI(
  apiKey: string,
  prompt: string,
): Promise<string | null> {
  const model = serverEnv.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `OpenAI API returned ${response.status}: ${body.slice(0, 300)}`,
    );
  }

  const data: { choices: { message?: { content?: string } }[] } =
    await response.json();
  const text = data.choices[0]?.message?.content;
  return text?.trim() || null;
}

/**
 * Generates a short (2-3 sentence) natural-language insight from the
 * current month's cash flow, category breakdown, and upcoming
 * commitments. Returns null (not an error) if neither ANTHROPIC_API_KEY
 * nor OPENAI_API_KEY is configured — see the comments on those env vars
 * in src/lib/env/server.ts.
 *
 * v1.2: added OPENAI_API_KEY as an alternate provider, at the user's
 * request (someone else in the household may only have an OpenAI key,
 * or prefer it). Anthropic is tried first when both are configured —
 * arbitrary as a technical matter (either would work), but keeps
 * behavior unchanged by default for the household that's already been
 * running on Anthropic since this feature shipped, rather than silently
 * switching providers out from under them the moment a second key
 * happens to be present.
 *
 * Runs fresh on every Intel page load (no caching) — simplest correct
 * behavior for a first version. Worth revisiting if this gets slow or
 * expensive at real usage volume: cache for a day and regenerate on a
 * schedule instead, trading a bit of staleness for speed/cost. Not
 * decided one way or the other yet, just flagged as the known tradeoff.
 */
export async function generateInsight(): Promise<string | null> {
  const anthropicKey = serverEnv.ANTHROPIC_API_KEY;
  const openaiKey = serverEnv.OPENAI_API_KEY;
  if (!anthropicKey && !openaiKey) {
    return null;
  }

  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  )
    .toISOString()
    .slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [settings, summary, trend, categories, upcoming] = await Promise.all([
    getUserSettings(OWNER_USER_ID),
    getCashFlowSummary({ from: monthStart, to: today }),
    getMonthlyExpenditureTrend(6),
    listCategories(true),
    listTransactions({
      status: "pending",
      occurredFrom: today,
      occurredTo: in90Days,
      limit: 20,
    }),
  ]);

  const currency = settings?.baseCurrency ?? "USD";
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  const categoryLines = summary.expenseByCategory
    .map(
      (c) =>
        `- ${categoryName.get(c.categoryId) ?? "Uncategorized"}: ${formatMoneyDisplay(c.total, currency)}`,
    )
    .join("\n");

  const trendLines = trend
    .map((t) => `- ${t.month}: ${formatMoneyDisplay(t.total, currency)}`)
    .join("\n");

  const upcomingLines = upcoming.transactions
    .map(
      (t) =>
        `- ${t.occurredOn}: ${t.payee ?? "Untitled"} (${formatMoneyDisplay(t.amount, t.currencyCode)})`,
    )
    .join("\n");

  const prompt = buildInsightPrompt({
    monthStart,
    today,
    currency,
    categoryLines,
    trendLines,
    upcomingLines,
    totalIncome: formatMoneyDisplay(summary.totalIncome, currency),
    totalExpense: formatMoneyDisplay(summary.totalExpense, currency),
    net: formatMoneyDisplay(summary.net, currency),
  });

  try {
    if (anthropicKey) {
      return await callAnthropic(anthropicKey, prompt);
    }
    return await callOpenAI(openaiKey as string, prompt);
  } catch (error) {
    console.error("Failed to generate Intel insight:", error);
    return null;
  }
}
