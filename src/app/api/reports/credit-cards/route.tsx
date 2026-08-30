import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";

import { requireUser } from "@/lib/auth/require-user";
import { monthLabel } from "@/lib/dates/month";
import { sumMoney } from "@/lib/money";
import {
  buildCombinedTransactionTable,
  buildLargestTransactions,
  buildLlmAnalysisPrompt,
  buildPerCardSummary,
  buildReportCategoryMerchantBreakdown,
  buildReportCategoryTotals,
  buildTopMerchantsOverall,
  computeGrandTotal,
} from "@/lib/intel/credit-card-report";
import { buildDonutSlices } from "@/lib/intel/donut";
import { getLatestCycleReportData } from "@/services/CreditCardIntelService";
import { listAtlasCategories } from "@/services/MerchantService";
import { getUserSettings } from "@/services/UserSettingsService";
import { CreditCardReportDocument } from "@/features/intel/pdf/CreditCardReportDocument";

// A generated PDF, not a stored file -- Node runtime is required for
// react-pdf's renderToBuffer (it isn't Edge-compatible).
export const runtime = "nodejs";

/**
 * v3.6.0 — the combined credit card expense report: every card's own
 * latest billing cycle, rolled into an executive-styled summary plus a
 * data-oriented appendix. GET (not a server action), matching this
 * app's existing "plain navigation for a real file download"
 * convention (see the attachments download route) -- the trigger is a
 * plain <a href> on the Intel page, no client JS needed. Generates and
 * streams a fresh buffer on every request rather than redirecting to
 * stored content, since there's nothing stored to redirect to.
 */
export async function GET() {
  const user = await requireUser();

  const cards = await getLatestCycleReportData();
  if (cards.length === 0) {
    return NextResponse.json(
      { error: "No credit card statements have been imported yet" },
      { status: 404 },
    );
  }

  const [categories, settings] = await Promise.all([
    listAtlasCategories(),
    getUserSettings(user.id),
  ]);
  const categoryName = new Map(categories.map((c) => [c.id, c.categoryName]));
  const currency = settings?.baseCurrency ?? "USD";

  // Cards can each carry a slightly different cycle_month -- label the
  // report by the latest one across all of them, same "most recent
  // real cycle wins" reasoning getLatestCycleReportData itself already
  // applies per card.
  const latestCycleMonth = [...cards]
    .map((c) => c.cycleMonth)
    .sort()
    .at(-1)!;
  const cycleLabel = monthLabel(latestCycleMonth);
  const generatedOn = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const grandTotal = computeGrandTotal(cards);
  const totalDue = sumMoney(cards.map((c) => c.totalAmountDue));
  const transactionCount = cards.reduce(
    (sum, c) => sum + c.transactions.length,
    0,
  );

  const donutSlices = buildDonutSlices(
    buildReportCategoryTotals(cards),
    categoryName,
  );

  const buffer = await renderToBuffer(
    <CreditCardReportDocument
      props={{
        cycleLabel,
        generatedOn,
        currency,
        grandTotal,
        totalDue,
        cardCount: cards.length,
        transactionCount,
        donutSlices,
        categoryMerchantBreakdown: buildReportCategoryMerchantBreakdown(
          cards,
          categoryName,
        ),
        perCardSummary: buildPerCardSummary(cards),
        topMerchants: buildTopMerchantsOverall(cards),
        largestTransactions: buildLargestTransactions(cards, categoryName),
        combinedTransactions: buildCombinedTransactionTable(
          cards,
          categoryName,
        ),
        llmPrompt: buildLlmAnalysisPrompt({
          cardCount: cards.length,
          cycleLabel,
          grandTotal,
          transactionCount,
          currency,
        }),
      }}
    />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="atlas-credit-card-report-${latestCycleMonth}.pdf"`,
    },
  });
}
