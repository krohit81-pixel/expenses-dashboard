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
 * Deep indigo gradient header, used at the top of every page. Plain
 * rectangle (no rounded corners) and a fixed minimum height — some pages
 * only pass a title (Calendar, Settings, More, ...) while others pass the
 * full title/label/amount/sub set (Dashboard, Budgets), and without a
 * fixed height the header visibly changed size switching between tabs.
 * Title always sits at the same top position regardless of what else is
 * present, so it's not hunting around the screen from page to page.
 */
export function Hero({ title, label, amount, sub, children }: HeroProps) {
  return (
    <header className="min-h-[170px] bg-gradient-to-br from-[hsl(var(--hero-1))] to-[hsl(var(--hero-2))] px-5 pb-6 pt-6 text-white sm:px-8">
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
