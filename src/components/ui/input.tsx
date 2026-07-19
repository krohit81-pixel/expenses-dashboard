import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * min-w-0 is load-bearing, not decorative — see the note on this exact
 * bug in AddTripModal.tsx and CreateTransactionForm.tsx. A native
 * `type="date"` input's own intrinsic content size (iOS Safari's date
 * picker chrome especially) can exceed its grid/flex track's available
 * width; without min-w-0 the browser default (`min-width: auto`) lets
 * the input refuse to shrink below that intrinsic size and it overflows
 * its container instead — even when the container is the input's only
 * child in that row. Fixed once here instead of re-adding min-w-0 at
 * every call site that happens to use a date input (this was patched
 * per-instance three times before it was worth fixing at the source).
 *
 * v1.1.5: still not resolved on-device after the min-w-0 fix, reported
 * a third time. Two more things layered on here rather than guessed at
 * blind a fourth time: `appearance-none` strips the browser's own
 * native chrome/sizing opinions for form controls (iOS Safari in
 * particular gives type="date" an intrinsic size that doesn't always
 * respect an explicit CSS height without this), and `h-11` was already
 * an explicit height rather than a min-height, which should act as a
 * hard cap rather than a floor — kept, just noted here since it's easy
 * to assume the opposite. Also worth noting: globals.css now sets
 * `color-scheme` explicitly (see that file's comment) — a mismatched
 * color-scheme was a plausible cause of a date input looking "blank" or
 * broken (white-on-white) rather than actually being oversized, so this
 * may address more of the reported symptom than the sizing fix alone
 * does. I can't test real iOS Safari rendering directly in this
 * environment — flag if this specific report persists after this
 * release, since the next step would be replacing the native date input
 * with a custom-rendered one rather than continuing to fight its native
 * chrome.
 */
export function Input({
  className,
  type,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full min-w-0 appearance-none rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-2 font-body text-sm text-ink placeholder:text-ink-faint focus-visible:border-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
