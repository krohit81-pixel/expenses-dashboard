import { Page, Text, View } from "@react-pdf/renderer";

import { formatMoneyForPdf } from "./format";
import type { CreditCardReportProps } from "./types";
import { styles } from "./theme";
import { Footer } from "./Footer";

export function PerCardSummaryPage({
  props,
}: {
  props: CreditCardReportProps;
}) {
  const { perCardSummary, currency } = props;

  return (
    <Page size="A4" style={styles.page} wrap>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionNumber}>03</Text>
        <Text style={styles.sectionTitle}>Per-Card Summary</Text>
      </View>

      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Card</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Due date</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>
          Total due
        </Text>
        <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>
          Min due
        </Text>
        <Text
          style={[styles.tableHeaderCell, { flex: 0.8, textAlign: "right" }]}
        >
          Utilization
        </Text>
        <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>
          This cycle
        </Text>
        <Text
          style={[styles.tableHeaderCell, { flex: 0.8, textAlign: "right" }]}
        >
          % of Total
        </Text>
      </View>
      {perCardSummary.map((card) => (
        <View key={card.cardKey} style={styles.tableRow}>
          <Text style={[styles.tableCell, { flex: 2 }]}>{card.cardLabel}</Text>
          <Text style={[styles.tableCellMuted, { flex: 1 }]}>
            {card.dueDate}
          </Text>
          <Text style={[styles.tableCellRight, { flex: 1 }]}>
            {formatMoneyForPdf(card.totalAmountDue, currency)}
          </Text>
          <Text style={[styles.tableCellRight, { flex: 1 }]}>
            {formatMoneyForPdf(card.minimumDue, currency)}
          </Text>
          <Text style={[styles.tableCellRight, { flex: 0.8 }]}>
            {card.utilizationPercent === null
              ? "—"
              : `${card.utilizationPercent.toFixed(0)}%`}
          </Text>
          <Text style={[styles.tableCellRight, { flex: 1 }]}>
            {formatMoneyForPdf(card.cycleSpend, currency)}
          </Text>
          <Text style={[styles.tableCellRight, { flex: 0.8 }]}>
            {card.percentOfGrandTotal.toFixed(1)}%
          </Text>
        </View>
      ))}
      <Footer />
    </Page>
  );
}
