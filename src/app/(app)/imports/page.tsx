import type { Metadata } from "next";

import { Hero } from "@/components/ui/hero";
import { StatementUploadForm } from "@/features/imports/components/StatementUploadForm";
import { isSpendableAccountType } from "@/lib/accounts/spendable";
import { listAccounts } from "@/services/AccountService";

export const metadata: Metadata = {
  title: "Imports",
};

/**
 * Phase 2: upload a statement PDF and it's decrypted, parsed,
 * reconciled against its own printed totals, and saved automatically --
 * no manual review step. If the numbers don't reconcile, or the layout
 * doesn't parse, nothing is saved and the error explains why.
 * Re-uploading an already-saved statement is safe and never creates a
 * duplicate. Four issuer slots today (see features/imports/cards.ts) --
 * the "HDFC Infinia only" framing from Phase 2's original single-card
 * milestone was stale, corrected here.
 *
 * v2.5.4: fetches accounts so StatementUploadForm can offer
 * LogCardDuePrompt right after a save — see that component's own
 * comment for why the import alone was never enough to make a
 * statement's due amount show up as a Dashboard expense.
 */
export default async function ImportsPage() {
  const accounts = await listAccounts();
  const cardAccounts = accounts.filter((a) => a.accountType === "credit_card");
  const checkingAccounts = accounts.filter((a) =>
    isSpendableAccountType(a.accountType),
  );

  return (
    <div>
      <Hero title="Imports" />
      <div className="space-y-4 p-5 sm:p-8">
        <div className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <h2 className="font-display text-base font-extrabold text-ink">
            Upload a statement
          </h2>
          <p className="mt-1 text-xs text-ink-faint">
            The PDF is decrypted, parsed, and saved automatically once its
            numbers reconcile against the statement&apos;s own totals.
          </p>
          <div className="mt-4">
            <StatementUploadForm
              cardAccounts={cardAccounts}
              checkingAccounts={checkingAccounts}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
