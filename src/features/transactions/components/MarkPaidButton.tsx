"use client";

import { useActionState } from "react";

import { Spinner } from "@/components/ui/spinner";
import {
  markTransactionPaidAction,
  type MarkPaidFormState,
} from "@/features/transactions/api/actions";

const initialState: MarkPaidFormState = {};

export function MarkPaidButton({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(
    markTransactionPaidAction,
    initialState,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={isPending}
        className="flex items-center gap-1 rounded-full bg-positive-soft px-2.5 py-1 font-display text-[10px] font-bold text-positive disabled:opacity-70"
      >
        {isPending && <Spinner className="size-3" />}
        Mark paid
      </button>
      {state.error && (
        <p className="mt-1 text-[10px] text-negative">{state.error}</p>
      )}
    </form>
  );
}
