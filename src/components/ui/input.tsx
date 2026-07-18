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
        "flex h-11 w-full min-w-0 rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-2 font-body text-sm text-ink placeholder:text-ink-faint focus-visible:border-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
