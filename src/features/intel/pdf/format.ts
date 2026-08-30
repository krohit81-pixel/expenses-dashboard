/**
 * A PDF-specific money formatter — react-pdf's built-in Helvetica (see
 * theme.ts's own note on why no custom font is bundled) has no glyph
 * for the Rupee sign (U+20B9) or several other currency symbols,
 * rendering as a garbled/missing character (confirmed against a real
 * generated report during verification). formatMoneyDisplay
 * (lib/money/money.ts) stays unchanged for the rest of the app, where
 * the browser's own system fonts render "₹" correctly — this
 * currency-code variant ("INR 1,234.56" instead of "₹1,234.56") is
 * used only inside src/features/intel/pdf, where it's also arguably a
 * better fit anyway: unambiguous for a document meant to be read by an
 * external LLM.
 */
import { moneyToDbNumber, type Money } from "@/lib/money";

export function formatMoneyForPdf(value: Money, currencyCode: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    currencyDisplay: "code",
  }).format(moneyToDbNumber(value));
}
