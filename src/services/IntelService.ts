import "server-only";

import {
  addMoney,
  compareMoney,
  formatMoneyDisplay,
  subtractMoney,
  ZERO,
  type Money,
} from "@/lib/money";
import {
  callConfiguredProvider,
  hasAiProviderConfigured,
} from "@/lib/ai/providers";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getCashFlowSummary,
  getMonthlyExpenditureTrend,
} from "@/services/ReportingService";
import { listTransactions } from "@/services/TransactionService";
import { listCategories } from "@/services/CategoryService";
import { getUserSettings } from "@/services/UserSettingsService";
import { getPlannedCardDuesForMonths } from "@/services/BudgetSnapshotService";
import { OWNER_USER_ID } from "@/lib/owner";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/dates/month";

/**
 * Builds the same prompt regardless of which provider ends up answering
 * it — the two providers are an implementation detail of *how* the
 * insight gets generated, not a reason for the household's data or the
 * instructions given about it to differ.
 *
 * v1.6.2: two changes made after real feedback on the first version's
 * output. (1) It picked "Entertainment" as the notable pattern when
 * Entertainment was only ~1% of spend — technically the largest
 * category-over-category delta doesn't mean much if every category is
 * small; the prompt now explicitly asks for a *sizeable* pattern, not
 * just whichever one happens to stand out proportionally. (2) It never
 * mentioned next month at all, despite Intel's own charts showing a
 * forecast — the household asked "does it cover forecast as well?" —
 * so the forecast total is now part of what's handed to the model, and
 * the instructions explicitly ask it to weigh both the current month
 * and next month's forecast, not just the current month in isolation.
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
  forecastMonthLabel: string;
  forecastTotalExpense: string;
}): string {
  return `You are a calm, factual personal finance assistant. Given this household's data for the current month AND the forecast for next month, write a short insight: 2-3 sentences, no more. Point out one genuinely notable pattern -- prefer a clear, sizeable trend or comparison over a marginal one (don't lead with a category that's only a percent or two of total spend just because it happens to be present); consider both what's already happened this month and what's forecast for next month, and be specific with numbers. Do not give generic advice like "consider budgeting." Do not use markdown formatting.

Current month so far (${params.monthStart} to ${params.today}):
- Income: ${params.totalIncome}
- Expenses: ${params.totalExpense}
- Net: ${params.net}

Expenses by category:
${params.categoryLines || "(none yet this month)"}

Expenditure trend, last 6 months:
${params.trendLines}

Forecast for ${params.forecastMonthLabel}, from recurring items and anything already tagged ahead of time:
- Expected expenses: ${params.forecastTotalExpense}

Upcoming one-time commitments, next 90 days:
${params.upcomingLines || "(none scheduled)"}`;
}

/**
 * Generates a short (2-3 sentence) natural-language insight from the
 * current month's cash flow, category breakdown, and upcoming
 * commitments. Returns null (not an error) if neither ANTHROPIC_API_KEY
 * nor GEMINI_API_KEY is configured, or if the call itself fails — see
 * the comments on those env vars in src/lib/env/server.ts.
 *
 * v1.2 added OPENAI_API_KEY as an alternate provider, at the user's
 * request (someone else in the household may only have an OpenAI key,
 * or prefer it). v1.6.0 replaced it with GEMINI_API_KEY instead, again
 * at the user's request — not kept as a third option, so there are
 * still only ever two providers to reason about.
 *
 * v1.6.1: this no longer runs on every Intel page load. Calling an LLM
 * API on every visit was slow (the page waited on it) and needlessly
 * repeated for a summary that doesn't need to change that often. It's
 * now only invoked by regenerateInsight(), itself only called from the
 * Intel page's "Generate commentary" button — see getStoredInsight()
 * for what's shown the rest of the time.
 *
 * v2.5.5: the actual provider calls (callAnthropic/callGemini) and the
 * "which provider, in what order" logic moved to lib/ai/providers.ts's
 * callConfiguredProvider, shared with MerchantMergeSuggestionService —
 * this function now just builds the prompt and hands it off.
 */
async function generateInsightText(): Promise<string | null> {
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

  // v1.6.2: the forecast the household asked about -- same next-month
  // range and includePending:true semantics as the Intel page's own
  // "projected" donut/bar (see intel/page.tsx's own comment on why
  // includePending is right for a month that hasn't happened yet:
  // recurring items and anything tagged ahead of time are effectively
  // the only data a future month can have).
  const forecastMonth = shiftMonth(currentMonth(), 1);
  const [forecastYear, forecastMonthNum] = forecastMonth.split("-").map(Number);
  const forecastFrom = new Date(Date.UTC(forecastYear, forecastMonthNum - 1, 1))
    .toISOString()
    .slice(0, 10);
  const forecastTo = new Date(Date.UTC(forecastYear, forecastMonthNum, 0))
    .toISOString()
    .slice(0, 10);

  const [settings, summary, trend, categories, upcoming, forecast] =
    await Promise.all([
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
      getCashFlowSummary({ from: forecastFrom, to: forecastTo }, true),
    ]);

  // v1.6.3: fold in the household's planned/logged credit card cycle
  // payment (same figure the Intel page's own donuts and month-on-
  // month chart now use -- see getPlannedCardDuesForMonths's own
  // comment) so the model reasons about the same numbers the page
  // actually shows. Before this, the model only ever saw the ledger's
  // own expense figures with no card dues at all, which is why an
  // earlier version called a category "predominant" that was really
  // just the largest LEDGER category, not the largest category on the
  // page the household was looking at.
  const thisMonthStr = currentMonth();
  const cardDuesMonths = [...trend.map((t) => t.month), forecastMonth];
  const plannedCardDues = await getPlannedCardDuesForMonths(cardDuesMonths);

  function combinedExpense(month: string, ledgerExpense: Money): Money {
    const dues = plannedCardDues.get(month);
    return dues && compareMoney(dues, ZERO) > 0
      ? addMoney(ledgerExpense, dues)
      : ledgerExpense;
  }

  const currency = settings?.baseCurrency ?? "USD";
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  const currentCardDues = plannedCardDues.get(thisMonthStr);
  const combinedCurrentExpense = combinedExpense(
    thisMonthStr,
    summary.totalExpense,
  );
  const combinedForecastExpense = combinedExpense(
    forecastMonth,
    forecast.totalExpense,
  );
  const combinedNet = subtractMoney(
    summary.totalIncome,
    combinedCurrentExpense,
  );

  const categoryLines = [
    ...summary.expenseByCategory.map(
      (c) =>
        `- ${categoryName.get(c.categoryId) ?? "Uncategorized"}: ${formatMoneyDisplay(c.total, currency)}`,
    ),
    ...(currentCardDues && compareMoney(currentCardDues, ZERO) > 0
      ? [`- Credit Card Dues: ${formatMoneyDisplay(currentCardDues, currency)}`]
      : []),
  ].join("\n");

  const trendLines = trend
    .map(
      (t) =>
        `- ${t.month}: ${formatMoneyDisplay(combinedExpense(t.month, t.total), currency)}`,
    )
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
    totalExpense: formatMoneyDisplay(combinedCurrentExpense, currency),
    net: formatMoneyDisplay(combinedNet, currency),
    forecastMonthLabel: monthLabel(forecastMonth),
    forecastTotalExpense: formatMoneyDisplay(combinedForecastExpense, currency),
  });

  try {
    return await callConfiguredProvider(prompt);
  } catch (error) {
    console.error("Failed to generate Intel insight:", error);
    return null;
  }
}

export interface StoredInsight {
  text: string;
  /** ISO timestamp of when this was generated. */
  generatedAt: string;
}

/**
 * The most recently generated Intel insight, if one has ever been
 * generated — v1.6.1, backing the Intel page's default (no-click)
 * view. null means "Generate commentary" has never been pressed yet
 * (a brand-new install, or one predating this feature); the page shows
 * a "pending generation" message in that case rather than an error.
 */
export async function getStoredInsight(): Promise<StoredInsight | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("intel_insights")
    .select("insight_text, generated_at")
    .eq("user_id", OWNER_USER_ID)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load the stored Intel insight: ${error.message}`,
    );
  }
  if (!data) return null;

  return { text: data.insight_text, generatedAt: data.generated_at };
}

export type RegenerateInsightResult =
  { ok: true; insight: StoredInsight } | { ok: false; reason: string };

/**
 * Generates a fresh insight and persists it as the new "most recent"
 * one (finance.intel_insights) — the only thing that calls
 * generateInsightText(), itself only reachable from the Intel page's
 * "Generate commentary" button (see
 * features/intel/api/actions.ts:generateInsightAction). On failure
 * (no provider configured, or the API call itself failed) the
 * previously stored insight is left untouched — a failed regeneration
 * attempt shouldn't blank out a perfectly good earlier insight, it
 * should just tell the user it didn't work this time.
 */
export async function regenerateInsight(): Promise<RegenerateInsightResult> {
  const text = await generateInsightText();
  if (!text) {
    return {
      ok: false,
      reason: hasAiProviderConfigured()
        ? "Something went wrong generating an insight. Please try again in a moment."
        : "No AI provider is configured — set ANTHROPIC_API_KEY or GEMINI_API_KEY.",
    };
  }

  const generatedAt = new Date().toISOString();
  const supabase = createServiceClient();
  const { error } = await supabase.from("intel_insights").upsert(
    {
      user_id: OWNER_USER_ID,
      insight_text: text,
      generated_at: generatedAt,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(
      `Failed to save the generated Intel insight: ${error.message}`,
    );
  }

  return { ok: true, insight: { text, generatedAt } };
}
