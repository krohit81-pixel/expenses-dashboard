import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        // min-w-0: same reasoning as Input's — a <select> with a long
        // option (an account name, say) can refuse to shrink below that
        // option's rendered width inside a grid/flex track otherwise.
        "flex h-11 w-full min-w-0 rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-2 font-body text-sm text-ink focus-visible:border-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
