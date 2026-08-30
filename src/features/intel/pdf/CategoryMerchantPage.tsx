/**
 * Category → merchant drill-down — the "press Shopping, see Raymond,
 * see it's tagged Clothing" ask, rendered flat/pre-expanded (a static
 * PDF can't be clicked, unlike Intel's own donut-slice drill-down).
 */
import { Page, Text, View } from "@react-pdf/renderer";

import { formatMoneyForPdf } from "./format";
import type { CreditCardReportProps } from "./types";
import { styles } from "./theme";
import { Footer } from "./Footer";

export function CategoryMerchantPage({
  props,
}: {
  props: CreditCardReportProps;
}) {
  const { categoryMerchantBreakdown, currency } = props;

  return (
    <Page size="A4" style={styles.page} wrap>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionNumber}>02</Text>
        <Text style={styles.sectionTitle}>Category to Merchant Detail</Text>
      </View>

      {categoryMerchantBreakdown.map((category) => (
        <View key={category.categoryId} wrap={false}>
          <View style={styles.categoryHeaderRow}>
            <Text style={styles.categoryHeaderText}>
              {category.categoryName} — {category.transactionCount} txn
              {category.transactionCount === 1 ? "" : "s"}
            </Text>
            <Text style={styles.categoryHeaderText}>
              {formatMoneyForPdf(category.total, currency)} (
              {category.percentOfGrandTotal.toFixed(1)}% of total)
            </Text>
          </View>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Merchant</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>
              Subcategory
            </Text>
            <Text
              style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}
            >
              Amount
            </Text>
            <Text
              style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}
            >
              % of Category
            </Text>
            <Text
              style={[
                styles.tableHeaderCell,
                { flex: 0.6, textAlign: "right" },
              ]}
            >
              Txns
            </Text>
          </View>
          {category.merchants.map((merchant, i) => (
            <View
              key={`${category.categoryId}-${merchant.merchantId ?? "none"}-${i}`}
              style={styles.tableRow}
            >
              <Text style={[styles.tableCell, { flex: 2 }]}>
                {merchant.displayName}
              </Text>
              <Text style={[styles.tableCellMuted, { flex: 1.5 }]}>
                {merchant.subcategoryName ?? "—"}
              </Text>
              <Text style={[styles.tableCellRight, { flex: 1 }]}>
                {formatMoneyForPdf(merchant.total, currency)}
              </Text>
              <Text style={[styles.tableCellRight, { flex: 1 }]}>
                {merchant.percentOfCategory.toFixed(1)}%
              </Text>
              <Text style={[styles.tableCellRight, { flex: 0.6 }]}>
                {merchant.transactionCount}
              </Text>
            </View>
          ))}
        </View>
      ))}
      <Footer />
    </Page>
  );
}
