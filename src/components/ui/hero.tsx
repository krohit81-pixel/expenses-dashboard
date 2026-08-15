import Link from "next/link";
import type { ReactNode } from "react";

import { APP_VERSION, getIndiaDateLabel } from "@/lib/version";

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
  /** Small control rendered top-right, before the date (v2.5.2) — e.g.
   * the theme toggle button on the public /calendar page, where the
   * full Appearance card on More isn't reachable without logging in. */
  topRightAction?: ReactNode;
}

/**
 * Header used at the top of every page. Plain rectangle (no rounded
 * corners) and a fixed minimum height — some pages only pass a title
 * (Calendar, Settings, More, ...) while others pass the full
 * title/label/amount/sub set (Dashboard, Budgets), and without a fixed
 * height the header visibly changed size switching between tabs.
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
 *
 * v1.1.6: wordmark + brand mark bumped again (22px -> 26px text, 44x52
 * -> 55x65 mark — same aspect ratio, just ~25% larger) at the user's
 * request while already touching this file for the date fix below.
 *
 * v2.5.8: a hamburger icon, linking to /more, now sits immediately
 * left of the wordmark — the "More" tab used to be a fifth item in
 * BottomNav/TopNav (see components/app-nav.tsx); the household wanted
 * it converted to a hamburger and moved up here instead, at the top
 * next to the logo, freeing BottomNav down to four evenly-spaced
 * primary tabs. Plain link, not a dropdown/drawer — every page already
 * renders Hero (the one exception, /onboarding, is a one-time
 * first-run flow that doesn't need it), so this is a reliable, global
 * way to reach /more without inventing new overlay/drawer state.
 *
 * v2.5.9: the atlas-mark.png image (the ring/plane/graduation-cap icon)
 * is gone from here, at the household's request — "just the word
 * 'Atlas' with version is enough." The public/atlas-mark.png asset
 * itself is untouched (still used on /login, a page outside this
 * component). Left column is now just the hamburger + "Atlas" +
 * version.
 *
 * v3.0.0: dropped the deep indigo gradient background (`--hero-1`/
 * `--hero-2`) the household had grown tired of — "keep it something
 * slick, don't need the different color header bar." The header now
 * sits flush on the page's own `--bg`, with a hairline `border-line`
 * bottom edge instead of a hard color block, and every element that
 * used to be a white-on-indigo override (icon, wordmark, title, amount,
 * captions) now uses the same ink/ink-soft/ink-faint/accent tokens the
 * rest of the app already reads by — so light/dark mode both fall out
 * for free instead of needing their own hero-specific tuning. `amount`
 * moved to `text-accent` (was plain white) to keep it reading as the
 * single loudest thing on the page now that a colored backdrop isn't
 * doing that job. The two callers that used to render their own
 * white-on-indigo month-nav pills inside Hero's `children`
 * (Dashboard, Budgets, Recurring) and the calendar `ThemeToggleButton`
 * were re-themed to accent-soft/accent alongside this — see those
 * files. `--hero-1`/`--hero-2` themselves are untouched in
 * `globals.css`; `/login`'s full-screen background still uses them on
 * purpose, since that's a distinct one-time screen, not this header.
 */
export function Hero({
  title,
  label,
  amount,
  sub,
  children,
  topRightAction,
}: HeroProps) {
  return (
    <header className="min-h-[190px] border-b border-line bg-bg px-5 pb-6 pt-6 text-ink sm:px-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link
            href="/more"
            aria-label="More"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-ink/5"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-[22px] fill-none stroke-current stroke-[1.8]"
              strokeLinecap="round"
            >
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
          </Link>
          <span className="font-display text-[26px] font-extrabold tracking-tight text-ink">
            Atlas
          </span>
          {/* v1.1.3: moved next to the wordmark, at the user's request —
              it used to live in the top-right corner paired with the
              date, which read as one throwaway timestamp string rather
              than "this is the version of the app you're looking at."
              v1.1.4: dropped the pill background behind it — plain text
              reads as part of the wordmark, not a separate ui chip. */}
          <span className="shrink-0 whitespace-nowrap font-display text-[11px] font-bold text-ink-faint">
            v{APP_VERSION}
          </span>
        </div>
        {/* v1.1.6: was a hardcoded per-release date string that only
            got updated by hand alongside APP_VERSION — see the comment
            on getIndiaDateLabel() for why that's what actually produced
            the "wrong timezone" report. This is computed fresh on every
            render, explicitly in India's timezone regardless of where
            the server itself runs. */}
        <div className="flex shrink-0 items-center gap-2.5">
          {topRightAction}
          <span className="whitespace-nowrap font-display text-[11.5px] font-semibold text-ink-faint">
            {getIndiaDateLabel()}
          </span>
        </div>
      </div>
      {title && (
        <div className="mt-3 font-display text-lg font-extrabold tracking-tight text-ink sm:text-xl">
          {title}
        </div>
      )}
      {label && <div className="mt-4 text-xs text-ink-faint">{label}</div>}
      {amount && (
        <div className="mt-1 font-display text-[30px] font-extrabold tracking-tight text-accent">
          {amount}
        </div>
      )}
      {sub && <div className="mt-1 text-xs text-ink-soft">{sub}</div>}
      {children}
    </header>
  );
}
