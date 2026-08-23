"use client";

import { useActionState } from "react";

import { Spinner } from "@/components/ui/spinner";
import {
  submitAhaanaAccessPasswordAction,
  type AhaanaAccessFormState,
} from "@/features/ahaana/api/actions";

const initialState: AhaanaAccessFormState = {};

/** Mirrors LoginForm (src/features/access-gate/components/LoginForm.tsx) almost exactly — same shape, a different action/cookie underneath. No `next` param: always lands on /ahaana itself, since there's nowhere else within her section to redirect back to yet. */
export function AhaanaLoginForm() {
  const [state, formAction, isPending] = useActionState(
    submitAhaanaAccessPasswordAction,
    initialState,
  );

  return (
    <form action={formAction} className="w-full max-w-sm space-y-5">
      <div className="space-y-1.5">
        <label
          htmlFor="ahaana-password"
          className="text-xs font-semibold text-white/70"
        >
          Password
        </label>
        <input
          id="ahaana-password"
          name="password"
          type="password"
          required
          autoFocus
          className="h-12 w-full rounded-2xl border-[1.5px] border-white/20 bg-white/10 px-4 text-base text-white placeholder-white/40 outline-none focus:border-white/50"
          placeholder="Enter password"
        />
      </div>
      {state.error && <p className="text-sm text-[#ff9fb2]">{state.error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white font-display text-sm font-bold text-[hsl(var(--hero-1))] disabled:opacity-60"
      >
        {isPending && <Spinner className="size-4" />}
        Continue
      </button>
    </form>
  );
}
