import Link from "next/link";
import type { Metadata } from "next";

import {
  listRecurringTransactions,
  listCycleTagsForMonth,
} from "@/services/RecurringTransactionService";
import { listAccounts } from "@/services/AccountService";
import { listCategories } from "@/services/CategoryService";
import { getUserSettings } from "@/services/UserSettingsService";
import { requireUser } from "@/lib/auth/require-user";
import {
  currentCycleMonth,
  isValidMonth,
  monthLabel,
  shiftMonth,
} from "@/lib/dates/month";
import { isDueInCycle } from "@/lib/dates/recurrence";
import { Hero } from "@/components/ui/hero";
import { formatFrequency } from "@/features/recurring/format";
import { RecurringLineItem } from "@/features/recurring/components/RecurringLineItem";
import { CreateRecurringTransactionForm } from "@/features/recurring/components/CreateRecurringTransactionForm";
import { GenerateDueTransactionsButton } from "@/features/recurring/components/GenerateDueTransactionsButton";
import {
  RecurringCycleTagger,
  type DueTemplateRow,
} from "@/features/recurring/components/RecurringCycleTagger";
import { NotDueTemplateRow } from "@/features/recurring/components/NotDueTemplateRow";

export const metadata: Metadata = {
  title: "Recurring",
};

function dayOfMonth(isoDate: string): number {
  return Number(isoDate.slice(8, 10));
}

function ordinal(day: number): string {
  if (day % 10 === 1 && day !== 11) return `${day}st`;
  if (day % 10 === 2 && day !== 12) return `${day}nd`;
  if (day % 10 === 3 && day !== 13) return `${day}rd`;
  return `${day}th`;
}

function scheduleLabel(
  frequency: string,
  intervalCount: number,
  nextOccurrenceOn: string,
): string {
  const base = formatFrequency(frequency, intervalCount);
  return frequency === "monthly"
    ? `${base} · ${ordinal(dayOfMonth(nextOccurrenceOn))}`
    : `${base} · next ${nextOccurrenceOn}`;
}

/**
 * v2.1: full rewrite. Recurring is now a cycle-scoped page (a `month`
 * search param + prev/next nav, matching Budgets/Dashboard) instead of a
 * flat template list with no cycle context at all. The bulk cycle-tagger
 * at the top (RecurringCycleTagger) replaces per-template
 * dropdown-and-button tagging; template CRUD (add/edit/delete) stays
 * below in "All templates", unchanged except that TagToCycleButton is
 * gone from each row — tagging now happens entirely through the bulk UI
 * above, or "Tag anyway" for something not naturally due this cycle.
 *
 * Transfer-kind templates (credit card due payments) are filtered out of
 * every list on this page as of v2.1 — the household now logs card dues
 * from statement PDF imports instead (see Log), not recurring templates.
 * Existing transfer templates in the database are untouched, just no
 * longer surfaced here.
 */
export default async function RecurringPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const cycleMonth = isValidMonth(monthParam)
    ? monthParam
    : currentCycleMonth();
  const isCurrentMonth = cycleMonth === currentCycleMonth();

  const user = await requireUser();
  const [allTemplates, tagged, accounts, categories, settings] =
    await Promise.all([
      listRecurringTransactions(),
      listCycleTagsForMonth(cycleMonth),
      listAccounts(),
      listCategories(true),
      getUserSettings(user.id),
    ]);

  const templates = allTemplates.filter((t) => t.kind !== "transfer");
  const defaultCurrency = settings?.baseCurrency ?? "USD";

  const due = templates.filter((t) =>
    isDueInCycle(t.nextOccurrenceOn, cycleMonth),
  );
  const notDue = templates.filter(
    (t) => !isDueInCycle(t.nextOccurrenceOn, cycleMonth),
  );

  function toRow(t: (typeof templates)[number]): DueTemplateRow {
    return {
      id: t.id,
      name: t.payee || "Untitled",
      amount: t.amount,
      currencyCode: t.currencyCode,
      scheduleLabel: scheduleLabel(
        t.frequency,
        t.intervalCount,
        t.nextOccurrenceOn,
      ),
      direction: t.kind === "income" ? "in" : "out",
      isTagged: tagged.has(t.id),
    };
  }

  const dueIncome = due.filter((t) => t.kind === "income").map(toRow);
  const dueExpenses = due.filter((t) => t.kind === "expense").map(toRow);

  return (
    <div>
      <Hero
        title="Recurring"
        sub="Everything due this cycle is pre-selected below — uncheck what doesn't apply, then Apply once."
      >
        <div className="mt-4 flex items-center gap-2">
          <Link
            href={`/recurring?month=${shiftMonth(cycleMonth, -1)}`}
            className="flex size-8 items-center justify-center rounded-full bg-white/15 text-sm text-white"
            aria-label="Previous cycle"
          >
            &#8249;
          </Link>
          <span className="min-w-[150px] text-center font-display text-sm font-bold text-white">
            {monthLabel(cycleMonth)} cycle
          </span>
          <Link
            href={`/recurring?month=${shiftMonth(cycleMonth, 1)}`}
            className="flex size-8 items-center justify-center rounded-full bg-white/15 text-sm text-white"
            aria-label="Next cycle"
          >
            &#8250;
          </Link>
          {!isCurrentMonth && (
            <Link
              href="/recurring"
              className="ml-1 rounded-full bg-white px-3 py-1.5 font-display text-xs font-bold text-[hsl(var(--hero-1))]"
            >
              Today
            </Link>
          )}
        </div>
      </Hero>

      <div className="space-y-6 p-5 sm:p-8">
        <GenerateDueTransactionsButton />

        <section>
          <RecurringCycleTagger
            cycleMonth={cycleMonth}
            income={dueIncome}
            expenses={dueExpenses}
          />
        </section>

        {notDue.length > 0 && (
          <details className="group rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
            <summary className="flex cursor-pointer items-center justify-between px-[18px] py-3.5 font-display text-[13px] font-bold text-ink">
              Not due this cycle · {notDue.length}
              <span className="text-ink-faint transition-transform group-open:rotate-180">
                &#9662;
              </span>
            </summary>
            <div>
              {notDue.map((t) => (
                <NotDueTemplateRow
                  key={t.id}
                  templateId={t.id}
                  name={t.payee || "Untitled"}
                  amount={t.amount}
                  currencyCode={t.currencyCode}
                  scheduleLabel={scheduleLabel(
                    t.frequency,
                    t.intervalCount,
                    t.nextOccurrenceOn,
                  )}
                  direction={t.kind === "income" ? "in" : "out"}
                  cycleMonth={cycleMonth}
                  taggedTransactionId={tagged.get(t.id) ?? null}
                />
              ))}
            </div>
          </details>
        )}

        <section>
          <h2 className="mb-3 font-display text-[15px] font-bold text-ink">
            All templates
          </h2>
          {templates.length === 0 ? (
            <p className="text-sm text-ink-faint">
              No recurring transactions yet.
            </p>
          ) : (
            <ul className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
              {templates.map((template) => (
                <RecurringLineItem
                  key={template.id}
                  id={template.id}
                  name={template.payee || "Untitled"}
                  amount={template.amount}
                  currencyCode={template.currencyCode}
                  nextOccurrenceOn={template.nextOccurrenceOn}
                  frequency={template.frequency}
                  intervalCount={template.intervalCount}
                  direction={template.kind === "income" ? "in" : "out"}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <h2 className="mb-4 font-display text-[15px] font-bold text-ink">
            Add a recurring transaction
          </h2>
          {accounts.length === 0 ? (
            <p className="text-sm text-ink-faint">
              <Link href="/accounts" className="underline">
                Add an account
              </Link>{" "}
              first.
            </p>
          ) : (
            <CreateRecurringTransactionForm
              accounts={accounts}
              categories={categories}
              defaultCurrency={defaultCurrency}
            />
          )}
        </section>
      </div>
    </div>
  );
}
