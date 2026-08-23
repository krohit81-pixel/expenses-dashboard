import type { ReactNode } from "react";

import { ahaanaLogoutAction } from "@/features/ahaana/api/actions";
import { RefreshOnShow } from "@/features/ahaana/components/RefreshOnShow";
import { AhaanaTabs } from "@/features/ahaana/components/AhaanaTabs";
import { todayISODate } from "@/lib/dates/calendar-grid";
import { APP_VERSION } from "@/lib/version";

/**
 * v3.4.0 — the chrome for every gated page under /ahaana (the weekly
 * view, /ahaana/manage). Deliberately NOT the main app's (app)/layout.tsx
 * — no BottomNav/TopNav pointing at Dashboard/Log/Intel/Calendar, since
 * this section has nothing to do with the rest of Atlas and she should
 * never be one tap away from it. middleware.ts is what actually
 * enforces her gate (see its own comment) — this layout only ever
 * renders once that's already passed.
 */
export const dynamic = "force-dynamic";

/**
 * v3.4.3 — a small, rotating, age-appropriate line at the bottom of
 * every page (she's 13, turning 14 soon — the household's own framing
 * for tone: encouraging without being childish or preachy). Picked
 * deterministically from today's IST date rather than randomly on the
 * client, so server and client render the same text and there's no
 * hydration mismatch — it still changes day to day, just not on every
 * page load.
 */
const FOOTER_LINES = [
  "One session at a time — you've got this. 🌱",
  "Progress, not perfection. Keep going!",
  "Future you is going to thank present you. ✨",
  "Small steps add up. You're doing great.",
  "Consistency beats intensity — nice work this week.",
  "Proud of you for showing up. Keep it up! 💪",
  "Every bit you cover today makes tomorrow easier.",
];

function footerLineForToday(): string {
  const dayOfYear = Math.floor(
    (new Date(`${todayISODate()}T00:00:00Z`).getTime() -
      new Date(`${todayISODate().slice(0, 4)}-01-01T00:00:00Z`).getTime()) /
      86_400_000,
  );
  return FOOTER_LINES[dayOfYear % FOOTER_LINES.length];
}

export default function AhaanaGatedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-dvh bg-bg">
      <RefreshOnShow />
      <header className="border-b border-line bg-surface px-5 pt-4 sm:px-8">
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-[15px] font-extrabold text-ink">
              Ahaana&apos;s Studies
            </span>
            {/* v3.4.8 — "so we know whether she is using latest," same
                v{APP_VERSION} convention the main app's own Hero uses. */}
            <span className="shrink-0 whitespace-nowrap font-display text-[10px] font-bold text-ink-faint">
              v{APP_VERSION}
            </span>
          </div>
          <form action={ahaanaLogoutAction}>
            <button
              type="submit"
              className="rounded-full border border-line px-3 py-1.5 font-display text-[11px] font-bold text-ink-soft"
            >
              Log out
            </button>
          </form>
        </div>
        <AhaanaTabs />
      </header>
      <main className="p-5 sm:p-8">{children}</main>
      <footer className="px-5 pb-8 text-center text-[12px] font-medium text-ink-faint sm:px-8">
        {footerLineForToday()}
      </footer>
    </div>
  );
}
