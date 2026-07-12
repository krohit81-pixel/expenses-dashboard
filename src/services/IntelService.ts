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

const MODEL = "claude-sonnet-5";

/**
 * Generates a short (2-3 sentence) natural-language insight from the
 * current month's cash flow, category breakdown, and upcoming
 * commitments. Returns null (not an error) if ANTHROPIC_API_KEY isn't
 * configured — see the comment on that env var in src/lib/env/server.ts.
 *
 * Runs fresh on every Intel page load (no caching) — simplest correct
 * behavior for a first version. Worth revisiting if this gets slow or
 * expensive at real usage volume: cache for a day and regenerate on a
 * schedule instead, trading a bit of staleness for speed/cost. Not
 * decided one way or the other yet, just flagged as the known tradeoff.
 *
 * Model string (claude-sonnet-5) matches Anthropic's current API model
 * name as of when this was written — verify against
 * https://docs.claude.com if this ever starts returning a model-not-found
 * error, since model names/versions do change over time.
 */
export async function generateInsight(): Promise<string | null> {
  if (!serverEnv.ANTHROPIC_API_KEY) {
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

  const prompt = `You are a calm, factual personal finance assistant. Given this household's data for the current month, write a short insight: 2-3 sentences, no more. Point out one genuinely notable pattern (spending trend, category standing out, or an upcoming commitment worth being aware of) and be specific with numbers. Do not give generic advice like "consider budgeting." Do not use markdown formatting.

Current month so far (${monthStart} to ${today}):
- Income: ${formatMoneyDisplay(summary.totalIncome, currency)}
- Expenses: ${formatMoneyDisplay(summary.totalExpense, currency)}
- Net: ${formatMoneyDisplay(summary.net, currency)}

Expenses by category:
${categoryLines || "(none yet this month)"}

Expenditure trend, last 6 months:
${trendLines}

Upcoming one-time commitments, next 90 days:
${upcomingLines || "(none scheduled)"}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": serverEnv.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
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
  } catch (error) {
    console.error("Failed to generate Intel insight:", error);
    return null;
  }
}
