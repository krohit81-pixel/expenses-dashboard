"use client";

import { useActionState } from "react";

import {
  submitAccessPasswordAction,
  type AccessGateFormState,
} from "@/features/access-gate/api/actions";

const initialState: AccessGateFormState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(
    submitAccessPasswordAction,
    initialState,
  );

  return (
    <form action={formAction} className="w-full max-w-sm space-y-5">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="text-xs font-semibold text-white/70"
        >
          Password
        </label>
        <input
          id="password"
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
        className="h-12 w-full rounded-full bg-white font-display text-sm font-bold text-[hsl(var(--hero-1))] disabled:opacity-60"
      >
        {isPending ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
