import Image from "next/image";
import type { ReactNode } from "react";

import {
  APP_VERSION,
  APP_VERSION_DATE,
  formatVersionDate,
} from "@/lib/version";

interface HeroProps {
  /** The page name, e.g. "Transactions" — now a real heading (v1.1.1), not a small secondary label. See the note below for why it used to be de-emphasized and isn't anymore. */
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
 * Bumped from 170px to 190px in v1.1.1 to give the now-larger title room
 * without cramping the label/amount/sub stack on pages that have both.
 *
 * The Atlas brand mark + name is hardcoded here, not a prop — it used to
 * only appear on Dashboard (passed in as that page's `title`), which
 * meant every other page's header didn't read as the same app at all.
 *
 * v1.1.1: title went from a small `text-white/50` caption to a real
 * bold heading, and the brand mark/wordmark both got bigger — the
 * previous sizing under-sold "this is Atlas" and "you're on the
 * Transactions page" on every page that isn't Dashboard. Amount (30px)
 * still reads as the largest element on pages that have one, so the
 * size hierarchy is: amount > title > label/sub — title just moved from
 * "barely there" to "clearly a heading" rather than overtaking amount.
 */
export function Hero({ title, label, amount, sub, children }: HeroProps) {
  return (
    <header className="min-h-[190px] bg-gradient-to-br from-[hsl(var(--hero-1))] to-[hsl(var(--hero-2))] px-5 pb-6 pt-6 text-white sm:px-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Image
            src="/atlas-mark.png"
            alt=""
            width={44}
            height={52}
            className="shrink-0"
            priority
          />
          <span className="font-display text-[22px] font-extrabold tracking-tight">
            Atlas
          </span>
          {/* v1.1.3: moved next to the wordmark, at the user's request —
              it used to live in the top-right corner paired with the
              date, which read as one throwaway timestamp string rather
              than "this is the version of the app you're looking at." */}
          <span className="shrink-0 whitespace-nowrap rounded-full bg-white/15 px-1.5 py-[1.5px] font-display text-[10px] font-bold text-white/80">
            v{APP_VERSION}
          </span>
        </div>
        <span className="shrink-0 whitespace-nowrap font-display text-[11.5px] font-semibold text-white/50">
          {formatVersionDate(APP_VERSION_DATE)}
        </span>
      </div>
      {title && (
        <div className="mt-3 font-display text-lg font-extrabold tracking-tight text-white sm:text-xl">
          {title}
        </div>
      )}
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
