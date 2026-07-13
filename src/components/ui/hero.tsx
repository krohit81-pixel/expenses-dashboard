import Image from "next/image";
import type { ReactNode } from "react";

interface HeroProps {
  /** The page name, e.g. "Transactions" — shown as a small label under the Atlas brand row, not the main heading anymore (see the note below). */
  title?: string;
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
 *
 * The Atlas brand mark + name is now hardcoded here, not a prop — it
 * used to only appear on Dashboard (passed in as that page's `title`),
 * which meant every other page's header didn't read as the same app at
 * all. `title` is now the page name specifically (Dashboard,
 * Transactions, Budgets, ...), shown smaller and secondary to the brand
 * row, not replacing it.
 */
export function Hero({ title, label, amount, sub, children }: HeroProps) {
  return (
    <header className="min-h-[170px] bg-gradient-to-br from-[hsl(var(--hero-1))] to-[hsl(var(--hero-2))] px-5 pb-6 pt-6 text-white sm:px-8">
      <div className="flex items-center gap-2">
        <Image
          src="/atlas-mark.png"
          alt=""
          width={22}
          height={25}
          className="shrink-0"
          priority
        />
        <span className="font-display text-[17px] font-bold">Atlas</span>
      </div>
      {title && <div className="mt-1 text-xs text-white/50">{title}</div>}
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
