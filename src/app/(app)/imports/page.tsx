import type { Metadata } from "next";

import { Hero } from "@/components/ui/hero";
import { StatementUploadForm } from "@/features/imports/components/StatementUploadForm";

export const metadata: Metadata = {
  title: "Imports",
};

/**
 * v1.3.0 milestone 1: confirm a card statement PDF — including a
 * password-protected one — can be reliably opened and its text
 * extracted. Deliberately stops there: nothing is parsed into
 * transactions and nothing is persisted yet. See
 * docs/12-roadmap-and-implementation-order.md's Phase 3 for where this
 * is headed; this page will grow a review queue once text extraction
 * has proven solid against real statements.
 */
export default function ImportsPage() {
  return (
    <div>
      <Hero title="Imports" />
      <div className="space-y-4 p-5 sm:p-8">
        <div className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <h2 className="font-display text-base font-extrabold text-ink">
            Upload a statement
          </h2>
          <p className="mt-1 text-xs text-ink-faint">
            First milestone: confirm we can open the PDF (decrypting it if
            it&apos;s password protected) and read its text. Transaction parsing
            comes in a later update.
          </p>
          <div className="mt-4">
            <StatementUploadForm />
          </div>
        </div>
      </div>
    </div>
  );
}
