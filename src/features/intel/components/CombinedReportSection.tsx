import { SectionChevron } from "@/components/ui/section-chevron";
import { DownloadReportButton } from "@/features/intel/components/DownloadReportButton";
import { hasAnyCreditCardStatement } from "@/services/CreditCardIntelService";

/**
 * v3.6.0 — the combined credit card PDF report's download trigger.
 * hasAnyCreditCardStatement() is the same cheap existence check the
 * card-level breakdown section already runs, gating on "any statement
 * ever imported" rather than "this specific month" -- the report
 * itself always covers each card's own latest statement, independent
 * of whatever month is currently being viewed above.
 *
 * v3.8.0 — extracted from intel/page.tsx so the new /cards page can
 * show the same section at the bottom of its own page, independent of
 * which of the 6 per-card toggles is selected there.
 */
export async function CombinedReportSection() {
  const anyCardStatements = await hasAnyCreditCardStatement();
  if (!anyCardStatements) return null;

  return (
    <details open className="group">
      <summary className="mb-3 flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
        <SectionChevron />
        <span className="font-display text-sm font-bold text-ink">
          Combined report
        </span>
      </summary>
      <div className="rounded-[20px] border-[1.5px] border-line bg-surface p-5">
        <p className="mb-3 text-sm leading-relaxed text-ink-soft">
          A single PDF across every card&apos;s own latest statement — overall
          breakdown, category-to-merchant detail, a per-card summary, and an
          appendix with a ready-to-paste AI analysis prompt.
        </p>
        <DownloadReportButton />
      </div>
    </details>
  );
}
