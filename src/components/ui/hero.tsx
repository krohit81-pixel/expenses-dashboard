import type { ReactNode } from "react";

import { TopNav } from "@/components/app-nav";

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
 * of every (app) page. Locked from prototype review — see
 * dashboard-v8-svg-icons.html. Each page supplies its own title/headline
 * metric since that varies per page; this component only owns the shared
 * shell (gradient, corners, nav).
 */
export function Hero({ title, label, amount, sub, children }: HeroProps) {
  return (
    <header className="rounded-b-[28px] bg-gradient-to-br from-hero-1 to-hero-2 px-5 pb-6 pt-6 text-white sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-[17px] font-bold">{title}</h1>
        <TopNav />
      </div>
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
