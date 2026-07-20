"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  generateInsightAction,
  type GenerateInsightState,
} from "@/features/intel/api/actions";

const initialState: GenerateInsightState = {};

/**
 * v1.6.1: the Intel page's AI insight is now generated on demand,
 * rather than on every page load -- see IntelService.regenerateInsight
 * for why. Pressing this hits the LLM provider, saves the result as
 * the new "most recent" insight, and (via revalidatePath in the
 * action) refreshes the server-rendered text above without a full
 * page reload.
 */
export function GenerateInsightButton() {
  const [state, formAction, isPending] = useActionState(
    generateInsightAction,
    initialState,
  );

  return (
    <form action={formAction} className="mt-3">
      <Button type="submit" variant="outline" size="sm" loading={isPending}>
        {isPending ? "Generating…" : "Generate commentary"}
      </Button>
      {state.error && (
        <p className="mt-1.5 text-xs text-negative">{state.error}</p>
      )}
    </form>
  );
}
