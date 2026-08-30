/**
 * Executive-style cover page — "like a BCG/Deloitte consultant would
 * submit," per the household's own request: an accent-colored title
 * band, a KPI row, and a few deterministic, computed-from-real-numbers
 * sentences. No AI-generated or fabricated prose here — that's
 * deliberately left to whatever LLM the household pastes the appendix
 * prompt into, not this page.
 */
import { Page, Text, View } from "@react-pdf/renderer";

import { moneyToDbNumber } from "@/lib/money";
import { formatMoneyForPdf } from "./format";
import type { CreditCardReportProps } from "./types";
import { COLORS, styles } from "./theme";
import { Footer } from "./Footer";

export function CoverPage({ props }: { props: CreditCardReportProps }) {
  const {
    cycleLabel,
    generatedOn,
    currency,
    grandTotal,
    totalDue,
    cardCount,
    transactionCount,
    donutSlices,
    largestTransactions,
  } = props;

  const topCategory = donutSlices[0];
  const largestTxn = largestTransactions[0];
  // Average transaction size is a derived, display-only figure (never
  // persisted or fed back into further Money arithmetic), so it's
  // computed and formatted as a plain number rather than round-tripped
  // through the Money type, which has no divide operation.
  const avgTxnNumber =
    transactionCount > 0 ? moneyToDbNumber(grandTotal) / transactionCount : 0;
  const avgTxn = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "code",
  }).format(avgTxnNumber);

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.accentBand}>
        <Text style={styles.wordmark}>ATLAS</Text>
        <Text style={styles.coverTitle}>Credit Card Expense Report</Text>
        <Text style={styles.coverSubtitle}>
          {cycleLabel} cycle — generated {generatedOn}
        </Text>
        <View style={styles.kpiRow}>
          <View style={styles.kpiTile}>
            <Text style={styles.kpiLabel}>TOTAL SPEND</Text>
            <Text style={styles.kpiValue}>
              {formatMoneyForPdf(grandTotal, currency)}
            </Text>
          </View>
          <View style={styles.kpiTile}>
            <Text style={styles.kpiLabel}>TOTAL DUE</Text>
            <Text style={styles.kpiValue}>
              {formatMoneyForPdf(totalDue, currency)}
            </Text>
          </View>
          <View style={styles.kpiTile}>
            <Text style={styles.kpiLabel}>CARDS</Text>
            <Text style={styles.kpiValue}>{cardCount}</Text>
          </View>
          <View style={styles.kpiTile}>
            <Text style={styles.kpiLabel}>TRANSACTIONS</Text>
            <Text style={styles.kpiValue}>{transactionCount}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Executive Summary</Text>
      <Text style={[styles.body, { marginTop: 10 }]}>
        Across {cardCount} card{cardCount === 1 ? "" : "s"}, total spend this
        cycle was {formatMoneyForPdf(grandTotal, currency)} across{" "}
        {transactionCount} transactions, averaging {avgTxn} per transaction.
        {topCategory
          ? ` ${topCategory.name} was the largest spending area at ${formatMoneyForPdf(
              topCategory.total,
              currency,
            )}.`
          : ""}
        {largestTxn
          ? ` The single largest transaction was ${formatMoneyForPdf(
              largestTxn.amount,
              currency,
            )} at ${largestTxn.description} on ${largestTxn.date}.`
          : ""}
      </Text>
      <Text style={[styles.caption, { marginTop: 16 }]}>
        This report covers each card&apos;s own most recently uploaded statement
        — see the Per-Card Summary section for each card&apos;s own billing
        period and due date. Full detail, including every transaction and a
        ready-to-use analysis prompt for an external AI assistant, is in the
        sections and appendix that follow.
      </Text>

      <View
        style={{
          marginTop: 20,
          borderTopWidth: 0.5,
          borderTopColor: COLORS.line,
          paddingTop: 10,
        }}
      >
        <Text style={styles.caption}>Contents</Text>
        <Text style={[styles.body, { marginTop: 4 }]}>
          1. Overall Breakdown{"\n"}
          2. Category to Merchant Detail{"\n"}
          3. Per-Card Summary{"\n"}
          4. Other Views — Top Merchants & Largest Transactions{"\n"}
          5. Appendix — AI Analysis Prompt & Combined Transaction Data
        </Text>
      </View>
      <Footer />
    </Page>
  );
}
