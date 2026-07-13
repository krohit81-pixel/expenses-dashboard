import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-display text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-accent text-white hover:bg-accent/90",
        outline:
          "border-[1.5px] border-line bg-surface text-ink-soft hover:bg-bg",
        ghost: "text-ink-soft hover:bg-bg",
        destructive: "bg-negative text-white hover:bg-negative/90",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-4",
        lg: "h-12 px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Shows a spinner and disables the button — pass the same `isPending`
   * value already returned by useActionState rather than hand-rolling
   * "disabled + swap the label text" per form. Ignored when asChild is
   * true (Slot needs exactly one child, so there's nowhere to put the
   * spinner without breaking that contract) — asChild is for link-styled
   * buttons anyway, which don't have a pending-submission state.
   */
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {!asChild && loading && <Spinner className="size-4" />}
      {children}
    </Comp>
  );
}
