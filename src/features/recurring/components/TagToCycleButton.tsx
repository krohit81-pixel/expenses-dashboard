"use client";

import { useActionState } from "react";

import { Spinner } from "@/components/ui/spinner";
import {
  tagRecurringToCycleAction,
  type TagToCycleFormState,
} from "@/features/recurring/api/actions";

const initialState: TagToCycleFormState = {};

function nextMonths(count: number): { value: string; label: string }[] {
  const now = new Date();
  const months: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1),
    );
    const value = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    months.push({ value, label });
  }
  return months;
}

export function TagToCycleButton({ templateId }: { templateId: string }) {
  const [state, formAction, isPending] = useActionState(
    tagRecurringToCycleAction,
    initialState,
  );
  const months = nextMonths(6);

  return (
    <form action={formAction} className="flex shrink-0 items-center gap-1">
      <input type="hidden" name="templateId" value={templateId} />
      <select
        name="cycleMonth"
        defaultValue={months[1]?.value}
        className="h-[26px] rounded-full border-[1.5px] border-line bg-surface px-2 text-[10px] font-semibold text-ink-soft"
      >
        {months.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="flex h-[26px] items-center justify-center gap-1 rounded-full bg-accent-soft px-2.5 font-display text-[10px] font-bold text-accent disabled:opacity-70"
      >
        {isPending && <Spinner className="size-3" />}
        Tag
      </button>
      {state.error && (
        <p className="w-full text-[10px] text-negative">{state.error}</p>
      )}
      {state.success && (
        <p className="w-full text-[10px] text-positive">Tagged.</p>
      )}
    </form>
  );
}
