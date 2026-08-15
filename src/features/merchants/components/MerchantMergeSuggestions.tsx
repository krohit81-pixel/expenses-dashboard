"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  mergeSuggestedMerchantAction,
  suggestMerchantMergesAction,
  type MergeSuggestionActionState,
  type SuggestMergesState,
} from "@/features/merchants/api/actions";
import type { MergeSuggestion } from "@/services/MerchantMergeSuggestionService";

const suggestInitialState: SuggestMergesState = {};

/**
 * v2.5.5: MerchantDictionaryService's deterministic resolver only ever
 * matches EXACT alias/name text, so any statement-text variation (an
 * order-ID suffix, a city name, an abbreviation) spawns a brand-new
 * "unmapped" merchant instead of being recognized as one already known
 * — the actual household report this shipped for: "I see a lot of
 * unmapped ones present" after an import. This button asks an LLM
 * (MerchantMergeSuggestionService.suggestMerchantMerges) to propose
 * which unmapped merchants are probably the same real business as one
 * already reviewed; nothing merges until a person confirms one
 * suggestion at a time via SuggestionRow below, which calls the exact
 * same mergeMerchants the manual "merge into" form on a merchant's own
 * detail page already uses.
 */
export function MerchantMergeSuggestions() {
  const [state, formAction, isPending] = useActionState(
    suggestMerchantMergesAction,
    suggestInitialState,
  );
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const visible = (state.suggestions ?? []).filter(
    (s) => !resolvedIds.has(s.sourceMerchantId),
  );

  // Stable across re-renders (useCallback, no deps beyond the setter,
  // which useState already guarantees is stable) — SuggestionRow below
  // depends on this identity staying put so its own effect only fires
  // once per merge, not on every unrelated re-render. See that
  // component's comment.
  const markResolved = useCallback((sourceMerchantId: string) => {
    setResolvedIds((prev) => {
      if (prev.has(sourceMerchantId)) return prev;
      return new Set(prev).add(sourceMerchantId);
    });
  }, []);

  return (
    <div className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
      <form
        action={formAction}
        className="flex items-start justify-between gap-3"
      >
        <div>
          <h2 className="flex items-center gap-1.5 font-display text-sm font-bold text-ink">
            <Sparkles className="size-3.5 text-accent" aria-hidden="true" />
            Suggested merges
          </h2>
          <p className="mt-0.5 text-xs text-ink-faint">
            AI-assisted — spots unmapped merchants that are probably the same
            business as one you already have, from wording alone. Nothing merges
            without your say-so.
          </p>
        </div>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          loading={isPending}
          className="shrink-0"
        >
          {isPending ? "Checking…" : "Find likely duplicates"}
        </Button>
      </form>

      {state.error && (
        <p className="mt-3 text-xs text-negative">{state.error}</p>
      )}

      {state.suggestions && visible.length === 0 && !state.error && (
        <p className="mt-3 text-xs text-ink-faint">
          No confident duplicates found.
        </p>
      )}

      {visible.length > 0 && (
        <ul className="mt-3.5 space-y-2">
          {visible.map((suggestion) => (
            <SuggestionRow
              key={suggestion.sourceMerchantId}
              suggestion={suggestion}
              onResolved={() => markResolved(suggestion.sourceMerchantId)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

const mergeInitialState: MergeSuggestionActionState = {};

function SuggestionRow({
  suggestion,
  onResolved,
}: {
  suggestion: MergeSuggestion;
  onResolved: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    mergeSuggestedMerchantAction,
    mergeInitialState,
  );
  const [dismissed, setDismissed] = useState(false);

  // Effect, not a call during render — this sets the PARENT's state
  // (removing this row from its list), and updating a different
  // component's state mid-render is exactly what React's rules
  // disallow. The parent removes this row once resolvedIds includes it;
  // render nothing in the meantime rather than a stale "Merge" button
  // that would resubmit an already-merged pair.
  useEffect(() => {
    if (state.success) onResolved();
  }, [state.success, onResolved]);

  if (dismissed || state.success) return null;

  return (
    <li className="rounded-xl bg-bg px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        {/* Source and target on separate lines, not one truncated
            "source → target" line — a long source name (statement raw
            text often is: order IDs, city suffixes) could truncate
            before the target name even appeared, hiding the one thing
            that matters most: what this would actually merge into. */}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">
            {suggestion.sourceName}
          </p>
          <p className="mt-0.5 truncate text-xs text-ink-faint">
            merges into{" "}
            <span className="font-semibold text-ink">
              {suggestion.targetName}
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-faint">{suggestion.reason}</p>
        </div>
        <span
          className={
            suggestion.confidence === "high"
              ? "shrink-0 rounded-full bg-positive-soft px-2 py-0.5 text-[10px] font-bold text-positive"
              : "shrink-0 rounded-full bg-amber-soft px-2 py-0.5 text-[10px] font-bold text-amber"
          }
        >
          {suggestion.confidence === "high" ? "High" : "Medium"} confidence
        </span>
      </div>

      {state.error && (
        <p className="mt-2 text-xs text-negative">{state.error}</p>
      )}

      <form action={formAction} className="mt-2.5 flex gap-2">
        <input
          type="hidden"
          name="sourceMerchantId"
          value={suggestion.sourceMerchantId}
        />
        <input
          type="hidden"
          name="targetMerchantId"
          value={suggestion.targetMerchantId}
        />
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-full px-3 py-1.5 font-display text-xs font-bold text-ink-faint"
        >
          Dismiss
        </button>
        <Button type="submit" size="sm" loading={isPending}>
          Merge
        </Button>
      </form>
    </li>
  );
}
