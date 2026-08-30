import { Page, Text, View } from "@react-pdf/renderer";

import { formatMoneyForPdf } from "./format";
import type { CreditCardReportProps } from "./types";
import { styles } from "./theme";
import { Footer } from "./Footer";

export function OtherViewsPage({ props }: { props: CreditCardReportProps }) {
  const { topMerchants, largestTransactions, currency } = props;

  return (
    <Page size="A4" style={styles.page} wrap>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionNumber}>04</Text>
        <Text style={styles.sectionTitle}>
          Other Views — Top Merchants & Largest Transactions
        </Text>
      </View>

      <Text
        style={[styles.body, { fontFamily: "Helvetica-Bold", marginBottom: 4 }]}
      >
        Top merchants overall
      </Text>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Merchant</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>
          Amount
        </Text>
        <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>
          % of Total
        </Text>
        <Text
          style={[styles.tableHeaderCell, { flex: 0.6, textAlign: "right" }]}
        >
          Txns
        </Text>
      </View>
      {topMerchants.map((m, i) => (
        <View key={`${m.merchantId ?? "none"}-${i}`} style={styles.tableRow}>
          <Text style={[styles.tableCell, { flex: 2 }]}>{m.displayName}</Text>
          <Text style={[styles.tableCellRight, { flex: 1 }]}>
            {formatMoneyForPdf(m.total, currency)}
          </Text>
          <Text style={[styles.tableCellRight, { flex: 1 }]}>
            {m.percentOfGrandTotal.toFixed(1)}%
          </Text>
          <Text style={[styles.tableCellRight, { flex: 0.6 }]}>
            {m.transactionCount}
          </Text>
        </View>
      ))}

      <Text
        style={[
          styles.body,
          { fontFamily: "Helvetica-Bold", marginTop: 20, marginBottom: 4 },
        ]}
      >
        Largest individual transactions
      </Text>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Date</Text>
        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Description</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Card</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Category</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>
          Amount
        </Text>
      </View>
      {largestTransactions.map((t) => (
        <View key={t.id} style={styles.tableRow}>
          <Text style={[styles.tableCellMuted, { flex: 1 }]}>{t.date}</Text>
          <Text style={[styles.tableCell, { flex: 2 }]}>{t.description}</Text>
          <Text style={[styles.tableCellMuted, { flex: 1 }]}>
            {t.cardLabel}
          </Text>
          <Text style={[styles.tableCellMuted, { flex: 1.2 }]}>
            {t.subcategoryName
              ? `${t.categoryName} / ${t.subcategoryName}`
              : t.categoryName}
          </Text>
          <Text style={[styles.tableCellRight, { flex: 1 }]}>
            {formatMoneyForPdf(t.amount, currency)}
          </Text>
        </View>
      ))}
      <Footer />
    </Page>
  );
}
