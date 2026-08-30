/**
 * Data-oriented appendix: the ready-to-paste LLM analysis prompt, then
 * the full combined transaction table — for an external LLM to ingest
 * alongside the PDF, not for human skimming (hence the plainer,
 * denser styling than the rest of the report, per the household's own
 * explicit "appendix section more data oriented so that LLM can read"
 * request). Relies on react-pdf's automatic multi-page wrapping for
 * the transaction table, which can run 250+ rows.
 */
import { Page, Text, View } from "@react-pdf/renderer";

import { formatMoneyForPdf } from "./format";
import type { CreditCardReportProps } from "./types";
import { styles } from "./theme";
import { Footer } from "./Footer";

export function AppendixPage({ props }: { props: CreditCardReportProps }) {
  const { llmPrompt, combinedTransactions, currency } = props;

  return (
    <Page size="A4" style={styles.page} wrap>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionNumber}>05</Text>
        <Text style={styles.sectionTitle}>
          Appendix — AI Analysis Prompt & Combined Transaction Data
        </Text>
      </View>

      <Text style={styles.appendixHeading}>A. Prompt for AI Analysis</Text>
      <Text style={[styles.caption, { marginBottom: 6 }]}>
        Paste this alongside the PDF into any LLM chat (ChatGPT, Claude, Gemini,
        etc.) for further insights.
      </Text>
      <View style={styles.promptBlock} wrap={false}>
        <Text>{llmPrompt}</Text>
      </View>

      <Text style={[styles.appendixHeading, { marginTop: 20 }]}>
        B. Combined Transaction Data ({combinedTransactions.length} rows)
      </Text>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Date</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Card</Text>
        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Description</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Category</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Subcategory</Text>
        <Text
          style={[styles.tableHeaderCell, { flex: 0.8, textAlign: "right" }]}
        >
          Amount
        </Text>
      </View>
      {combinedTransactions.map((row, i) => (
        <View key={i} style={styles.tableRow} wrap={false}>
          <Text style={[styles.tableCellMuted, { flex: 1, fontSize: 8 }]}>
            {row.date}
          </Text>
          <Text style={[styles.tableCellMuted, { flex: 1.2, fontSize: 8 }]}>
            {row.cardLabel}
          </Text>
          <Text style={[styles.tableCell, { flex: 2, fontSize: 8 }]}>
            {row.description}
          </Text>
          <Text style={[styles.tableCellMuted, { flex: 1, fontSize: 8 }]}>
            {row.categoryName}
          </Text>
          <Text style={[styles.tableCellMuted, { flex: 1, fontSize: 8 }]}>
            {row.subcategoryName ?? "—"}
          </Text>
          <Text style={[styles.tableCellRight, { flex: 0.8, fontSize: 8 }]}>
            {formatMoneyForPdf(row.amount, currency)}
          </Text>
        </View>
      ))}
      <Footer />
    </Page>
  );
}
