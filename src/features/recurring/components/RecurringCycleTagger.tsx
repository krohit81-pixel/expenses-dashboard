"use client";

import { useActionState, useMemo, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { formatMoneyDisplay, type Money } from "@/lib/money";
import {
  applyCycleTagsAction,
  type ApplyCycleTagsFormState,
} from "@/features/recurring/api/actions";

const initialState: ApplyCycleTagsFormState = {};

export interface DueTemplateRow {
  id: string;
  name: string;
  amount: Money;
  currencyCode: string;
  scheduleLabel: string;
  direction: "in" | "out";
  isTagged: boolean;
}

/**
 * v2.1: the bulk cycle-tagging UI, replacing per-template
 * dropdown-and-button tagging (TagToCycleButton) one at a time. Every
 * template "due this cycle" (see the page's own isDueInCycle check)
 * starts checked — the household's own framing is that most recurring
 * items should count by default, so this flips the old opt-in model to
 * opt-out: uncheck what's paused or skipped, then Apply once.
 *
 * Real checkboxes named "desiredTemplateIds" do the actual submission
 * work (a browser only includes a checked checkbox's value in FormData —
 * exactly the "desired end state" applyCycleTags wants), controlled here
 * only so the running "N of M selected" count and Select/Deselect all can
 * stay in sync. Every due template also gets a parallel hidden
 * "candidateTemplateIds" input regardless of checked state, so the server
 * always knows the full due-set to reconcile against — see
 * applyCycleTags's own comment.
 *
 * Note: this doesn't persist "explicitly excluded this cycle" anywhere —
 * there's no such column. Uncheck Gym and Apply, and it stops being
 * tagged; but revisit this page later and Gym starts checked again,
 * since "due this cycle" is computed fresh from the template's own
 * schedule each time, not from a remembered choice. That's a deliberate
 * trade-off, not an oversight — the alternative (a new persisted
 * exclusion flag per template per cycle) felt like real schema work for
 * a case (a template paused indefinitely) better solved by editing the
 * template itself.
 */
export function RecurringCycleTagger({
  cycleMonth,
  income,
  expenses,
}: {
  cycleMonth: string;
  income: DueTemplateRow[];
  expenses: DueTemplateRow[];
}) {
  const due = useMemo(() => [...income, ...expenses], [income, expenses]);
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(due.map((t) => t.id)),
  );
  const [state, formAction, isPending] = useActionState(
    applyCycleTagsAction,
    initialState,
  );

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderRow(t: DueTemplateRow) {
    const isChecked = checked.has(t.id);
    return (
      <label
        key={t.id}
        className={`flex cursor-pointer items-center gap-3 border-b border-line px-[18px] py-3 last:border-b-0 ${
          isChecked ? "" : "opacity-50"
        }`}
      >
        <input
          type="checkbox"
          name="desiredTemplateIds"
          value={t.id}
          checked={isChecked}
          onChange={() => toggle(t.id)}
          className="size-[18px] shrink-0 accent-accent"
        />
        <input type="hidden" name="candidateTemplateIds" value={t.id} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">
            {t.name}
            {t.isTagged && (
              <span className="ml-1.5 rounded-full bg-positive-soft px-1.5 py-0.5 align-middle font-display text-[9px] font-extrabold uppercase tracking-wide text-positive">
                Tagged
              </span>
            )}
          </p>
          <p className="text-xs text-ink-faint">{t.scheduleLabel}</p>
        </div>
        <p
          className={`whitespace-nowrap font-display text-sm font-bold ${
            t.direction === "in" ? "text-positive" : "text-negative"
          }`}
        >
          {t.direction === "in" ? "+" : "−"}
          {formatMoneyDisplay(t.amount, t.currencyCode)}
        </p>
      </label>
    );
  }

  if (due.length === 0) {
    return (
      <div className="rounded-[20px] bg-surface p-4 shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
        <p className="text-sm text-ink-faint">
          Nothing due this cycle — add a recurring template below, or check
          &quot;Not due this cycle&quot; if something should apply anyway.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="cycleMonth" value={cycleMonth} />

      <div className="mb-2.5 flex items-center justify-between px-0.5">
        <span className="text-xs font-semibold text-ink-soft">
          <b className="text-ink">{checked.size}</b> of {due.length} selected
        </span>
        <button
          type="button"
          onClick={() =>
            setChecked(
              checked.size === due.length
                ? new Set()
                : new Set(due.map((t) => t.id)),
            )
          }
          className="font-display text-[11px] font-bold text-accent"
        >
          {checked.size === due.length ? "Deselect all" : "Select all"}
        </button>
      </div>

      {income.length > 0 && (
        <>
          <h3 className="mb-1.5 font-display text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            Income
          </h3>
          <div className="mb-3.5 rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
            {income.map(renderRow)}
          </div>
        </>
      )}

      {expenses.length > 0 && (
        <>
          <h3 className="mb-1.5 font-display text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            Expenses
          </h3>
          <div className="mb-3.5 rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
            {expenses.map(renderRow)}
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 font-display text-sm font-bold text-white disabled:opacity-60"
      >
        {isPending && <Spinner className="size-4" />}
        Apply to this cycle
      </button>
      {state.error && (
        <p className="mt-2 text-center text-xs text-negative">{state.error}</p>
      )}
      {state.message && (
        <p className="mt-2 text-center text-xs text-positive">
          {state.message}
        </p>
      )}
    </form>
  );
}
