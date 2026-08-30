/**
 * The combined credit card PDF report's top-level Document — composes
 * every section in order. Pure rendering only: every aggregation and
 * category-name resolution already happened before this component tree
 * ever runs (see the route handler, src/app/api/reports/credit-cards/route.ts).
 */
import { Document } from "@react-pdf/renderer";

import type { CreditCardReportProps } from "./types";
import { CoverPage } from "./CoverPage";
import { OverallBreakdownPage } from "./OverallBreakdownPage";
import { CategoryMerchantPage } from "./CategoryMerchantPage";
import { PerCardSummaryPage } from "./PerCardSummaryPage";
import { OtherViewsPage } from "./OtherViewsPage";
import { AppendixPage } from "./AppendixPage";

export function CreditCardReportDocument({
  props,
}: {
  props: CreditCardReportProps;
}) {
  return (
    <Document
      title={`Atlas Credit Card Expense Report — ${props.cycleLabel}`}
      author="Atlas"
    >
      <CoverPage props={props} />
      <OverallBreakdownPage props={props} />
      <CategoryMerchantPage props={props} />
      <PerCardSummaryPage props={props} />
      <OtherViewsPage props={props} />
      <AppendixPage props={props} />
    </Document>
  );
}
