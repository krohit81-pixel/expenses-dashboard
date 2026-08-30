import { Page, Text, View } from "@react-pdf/renderer";

import { moneyToDbNumber } from "@/lib/money";
import { formatMoneyForPdf } from "./format";
import type { CreditCardReportProps } from "./types";
import { styles } from "./theme";
import { ReportDonut } from "./Donut";
import { Footer } from "./Footer";

export function OverallBreakdownPage({
  props,
}: {
  props: CreditCardReportProps;
}) {
  const { donutSlices, currency, grandTotal } = props;
  const grandTotalNum = moneyToDbNumber(grandTotal);

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionNumber}>01</Text>
        <Text style={styles.sectionTitle}>Overall Breakdown</Text>
      </View>

      <ReportDonut slices={donutSlices} currency={currency} />

      <View style={[styles.table, { marginTop: 24 }]}>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Category</Text>
          <Text
            style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}
          >
            Amount
          </Text>
          <Text
            style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}
          >
            % of Total
          </Text>
        </View>
        {donutSlices.map((slice) => (
          <View key={slice.name} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2 }]}>{slice.name}</Text>
            <Text style={[styles.tableCellRight, { flex: 1 }]}>
              {formatMoneyForPdf(slice.total, currency)}
            </Text>
            <Text style={[styles.tableCellRight, { flex: 1 }]}>
              {grandTotalNum > 0
                ? `${((moneyToDbNumber(slice.total) / grandTotalNum) * 100).toFixed(1)}%`
                : "0.0%"}
            </Text>
          </View>
        ))}
      </View>
      <Footer />
    </Page>
  );
}
