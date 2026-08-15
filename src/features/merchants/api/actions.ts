"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  mergeMerchants,
  tagTransactionToMerchant,
  untagTransaction,
  updateMerchant,
} from "@/services/MerchantService";
import {
  suggestMerchantMerges,
  type MergeSuggestion,
} from "@/services/MerchantMergeSuggestionService";

export interface MerchantFormState {
  success?: boolean;
  error?: string;
}

function nullableString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Full-object edit: category, subcategory, display name, merchant type,
 * recurring/subscription flags — every field the form shows is always
 * submitted, so there's no partial-patch ambiguity to handle here (a
 * cleared dropdown means "set to null", not "leave unchanged").
 */
export async function updateMerchantAction(
  _prevState: MerchantFormState,
  formData: FormData,
): Promise<MerchantFormState> {
  const merchantId = formData.get("merchantId");
  if (typeof merchantId !== "string" || !merchantId) {
    return { error: "Missing merchant." };
  }

  const displayName = nullableString(formData, "displayName");
  if (!displayName) {
    return { error: "Display name can't be empty." };
  }

  try {
    await updateMerchant({
      merchantId,
      displayName,
      atlasCategoryId: nullableString(formData, "atlasCategoryId"),
      atlasSubcategoryId: nullableString(formData, "atlasSubcategoryId"),
      merchantType: nullableString(formData, "merchantType"),
      isRecurring: formData.get("isRecurring") === "on",
      isSubscription: formData.get("isSubscription") === "on",
    });
    revalidatePath("/merchants");
    revalidatePath(`/merchants/${merchantId}`);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update merchant.",
    };
  }
}

export async function setMerchantActiveAction(
  _prevState: MerchantFormState,
  formData: FormData,
): Promise<MerchantFormState> {
  const merchantId = formData.get("merchantId");
  const active = formData.get("active");
  if (typeof merchantId !== "string" || !merchantId) {
    return { error: "Missing merchant." };
  }

  try {
    await updateMerchant({ merchantId, active: active === "true" });
    revalidatePath("/merchants");
    revalidatePath(`/merchants/${merchantId}`);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update merchant.",
    };
  }
}

/**
 * Untags a single transaction from its merchant -- the per-row undo
 * MergeMerchantForm/updateMerchantAction don't offer. merchantId is
 * only carried along to know which merchant detail page to
 * revalidate; the transaction itself is looked up (and scoped to the
 * owner) entirely by transactionId inside untagTransaction.
 */
export async function untagTransactionAction(
  _prevState: MerchantFormState,
  formData: FormData,
): Promise<MerchantFormState> {
  const transactionId = formData.get("transactionId");
  const merchantId = formData.get("merchantId");
  if (typeof transactionId !== "string" || !transactionId) {
    return { error: "Missing transaction." };
  }

  try {
    await untagTransaction(transactionId);
    if (typeof merchantId === "string" && merchantId) {
      revalidatePath(`/merchants/${merchantId}`);
    }
    revalidatePath("/merchants");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to untag transaction.",
    };
  }
}

/**
 * Manually assigns a transaction that has no merchant to one --
 * v1.2.1, for isBankFeeOrTax lines (IGST, FX markup fees, DCC
 * surcharges) that are deliberately never auto-tagged at import time
 * (see tagTransactionToMerchant's own comment) and so have no other
 * way to reach a merchant/category. Revalidates the Merchants list,
 * the target merchant's own detail page, and the Card-level
 * breakdown drill-down (revalidatePath matches by pathname regardless
 * of query string, so this covers every month/category/card
 * combination of that route, not just the one the form happened to
 * submit from).
 */
export async function tagTransactionAction(
  _prevState: MerchantFormState,
  formData: FormData,
): Promise<MerchantFormState> {
  const transactionId = formData.get("transactionId");
  const merchantId = formData.get("merchantId");
  if (typeof transactionId !== "string" || !transactionId) {
    return { error: "Missing transaction." };
  }
  if (typeof merchantId !== "string" || !merchantId) {
    return { error: "Choose a merchant." };
  }

  try {
    await tagTransactionToMerchant({ transactionId, merchantId });
    revalidatePath("/merchants");
    revalidatePath(`/merchants/${merchantId}`);
    revalidatePath("/intel/card-category");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to tag transaction.",
    };
  }
}

export async function mergeMerchantsAction(
  _prevState: MerchantFormState,
  formData: FormData,
): Promise<MerchantFormState> {
  const sourceMerchantId = formData.get("sourceMerchantId");
  const targetMerchantId = formData.get("targetMerchantId");

  if (typeof sourceMerchantId !== "string" || !sourceMerchantId) {
    return { error: "Missing merchant." };
  }
  if (typeof targetMerchantId !== "string" || !targetMerchantId) {
    return { error: "Choose a merchant to merge into." };
  }

  try {
    await mergeMerchants({ sourceMerchantId, targetMerchantId });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to merge merchants.",
    };
  }

  // Deliberately outside the try/catch: redirect() works by throwing a
  // special Next.js-internal signal, which the catch block above would
  // otherwise swallow and misreport as a failed merge. Redirecting (not
  // just returning success) matters because the page the user submitted
  // this form from IS the source merchant's own detail page -- that
  // merchant no longer exists after a successful merge, so revalidating
  // and re-rendering that same URL (which Next does automatically after
  // a Server Action completes) would otherwise 404 immediately, even
  // though the merge itself succeeded.
  revalidatePath("/merchants");
  revalidatePath(`/merchants/${targetMerchantId}`);
  redirect(`/merchants/${targetMerchantId}`);
}

export interface SuggestMergesState {
  suggestions?: MergeSuggestion[];
  error?: string;
}

/**
 * Button-triggered (MerchantMergeSuggestions, on the Merchants list
 * page), same "not on page load" reasoning as Intel's
 * generateInsightAction — an LLM call is slow and this list doesn't
 * need to be fresh on every visit, only when actually asked for.
 * Read-only: returns candidate (unmapped, established) pairs for a
 * human to review, never merges anything itself — see
 * mergeSuggestedMerchantAction below for the actual mutation, and
 * MerchantMergeSuggestionService's own comment for why that split
 * matters.
 */
export async function suggestMerchantMergesAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's action signature
  _prevState: SuggestMergesState,
): Promise<SuggestMergesState> {
  const result = await suggestMerchantMerges();
  if (!result.ok) {
    return { error: result.reason };
  }
  return { suggestions: result.suggestions };
}

export interface MergeSuggestionActionState {
  success?: boolean;
  error?: string;
}

/**
 * A near-duplicate of mergeMerchantsAction above, deliberately not
 * shared with it: that action redirects to the target merchant's page
 * because it's only ever submitted FROM the source merchant's own
 * detail page, which 404s once the merge deletes that merchant. This
 * one is submitted from the Merchants LIST page instead (one row inside
 * MerchantMergeSuggestions, possibly several still left to review) —
 * redirecting away would lose the rest of that in-progress review, so
 * this just revalidates and returns success, letting the client remove
 * the merged row from its own list locally instead of navigating.
 */
export async function mergeSuggestedMerchantAction(
  _prevState: MergeSuggestionActionState,
  formData: FormData,
): Promise<MergeSuggestionActionState> {
  const sourceMerchantId = formData.get("sourceMerchantId");
  const targetMerchantId = formData.get("targetMerchantId");

  if (typeof sourceMerchantId !== "string" || !sourceMerchantId) {
    return { error: "Missing merchant." };
  }
  if (typeof targetMerchantId !== "string" || !targetMerchantId) {
    return { error: "Missing target merchant." };
  }

  try {
    await mergeMerchants({ sourceMerchantId, targetMerchantId });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to merge merchants.",
    };
  }

  revalidatePath("/merchants");
  return { success: true };
}

export interface BulkMergeFormState {
  success?: boolean;
  mergedCount?: number;
  error?: string;
}

/**
 * v2.5.7: the multi-select "Merge N into…" bar on the Merchants list —
 * at the household's request, a way to clear several unmapped merchants
 * in one pass without a per-pair round trip through
 * MerchantMergeSuggestions (that's still there for AI-suggested pairs;
 * this is for when a person has already eyeballed several rows and
 * knows they're all the same real merchant). Loops mergeMerchants()
 * sequentially, same reasoning as every other multi-row merchant
 * mutation in this app (RecurringTransactionService.applyCycleTags,
 * scripts/bulk-merge-merchants.mjs): each merge fully completes before
 * the next starts, so a failure partway through leaves a known,
 * reportable state (mergedCount) instead of a partial, ambiguous one
 * from a parallel Promise.all.
 */
export async function bulkMergeMerchantsAction(
  _prevState: BulkMergeFormState,
  formData: FormData,
): Promise<BulkMergeFormState> {
  const targetMerchantId = formData.get("targetMerchantId");
  if (typeof targetMerchantId !== "string" || !targetMerchantId) {
    return { error: "Choose a merchant to merge into." };
  }

  const sourceMerchantIds = formData
    .getAll("sourceMerchantId")
    .filter(
      (id): id is string => typeof id === "string" && id !== targetMerchantId,
    );
  if (sourceMerchantIds.length === 0) {
    return { error: "Select at least one other merchant to merge." };
  }

  let mergedCount = 0;
  try {
    for (const sourceMerchantId of sourceMerchantIds) {
      await mergeMerchants({ sourceMerchantId, targetMerchantId });
      mergedCount += 1;
    }
  } catch (error) {
    return {
      mergedCount,
      error:
        error instanceof Error
          ? `Merged ${mergedCount} of ${sourceMerchantIds.length} before this failed: ${error.message}`
          : "Failed to merge merchants.",
    };
  }

  revalidatePath("/merchants");
  return { success: true, mergedCount };
}
