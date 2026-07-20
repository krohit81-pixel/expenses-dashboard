"use server";

import { revalidatePath } from "next/cache";

import { regenerateInsight } from "@/services/IntelService";

export interface GenerateInsightState {
  error?: string;
}

/**
 * Regenerates the Intel page's AI insight on demand -- v1.6.1, behind
 * the "Generate commentary" button (no longer called automatically on
 * every page load, see IntelService.generateInsightText's own
 * comment). revalidatePath rather than returning the new text directly:
 * the insight card is rendered by the Server Component
 * (getStoredInsight), so refreshing that data is enough to show the
 * new text -- this action's own return value only needs to carry an
 * error, if there is one.
 */
export async function generateInsightAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's action signature
  _prevState: GenerateInsightState,
): Promise<GenerateInsightState> {
  const result = await regenerateInsight();
  if (!result.ok) {
    return { error: result.reason };
  }

  revalidatePath("/intel");
  return {};
}
