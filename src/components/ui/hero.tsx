import type { ReactNode } from "react";

interface HeroProps {
  title: string;
  /** Small label above the headline amount, e.g. "Net across all accounts". */
  label?: string;
  /** The big headline number, e.g. "₹4,82,150". Pass pre-formatted text. */
  amount?: string;
  /** Small caption under the amount, e.g. the period or a one-line explainer. */
  sub?: string;
  /** Extra content below the headline block — period pickers, etc. */
  children?: ReactNode;
}

/**
 * Deep indigo gradient header with rounded bottom corners, used at the top
 * of the four pages that have a headline metric (Dashboard, Transactions,
 * Budgets, Intel). Nav lives in the shared (app)/layout.tsx now, not here —
 * it used to be rendered inside this component, but that meant pages
 * without a Hero (Accounts, Recurring, Net worth, Settings, More) had no
 * desktop navigation at all. Single persistent nav location, works the
 * same on every page.
 */
export function Hero({ title, label, amount, sub, children }: HeroProps) {
  return (
    <header className="rounded-b-[28px] bg-gradient-to-br from-hero-1 to-hero-2 px-5 pb-6 pt-6 text-white sm:px-8">
      <h1 className="font-display text-[17px] font-bold">{title}</h1>
      {label && <div className="mt-4 text-xs text-white/65">{label}</div>}
      {amount && (
        <div className="mt-1 font-display text-[30px] font-extrabold tracking-tight text-white">
          {amount}
        </div>
      )}
      {sub && <div className="mt-1 text-xs text-white/55">{sub}</div>}
      {children}
    </header>
  );
}
