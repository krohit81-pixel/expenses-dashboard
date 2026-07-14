import type { Metadata } from "next";

import { Hero } from "@/components/ui/hero";
import { CalendarPersonToggle } from "@/features/calendar/CalendarPersonToggle";
import {
  AHAANA_CALENDAR,
  AHAANA_TRAVEL_WINDOWS,
  ROHANA_CALENDAR,
  ROHANA_TBC_HOLIDAYS,
  ROHANA_TRAVEL_WINDOWS,
} from "@/features/calendar/data";

export const metadata: Metadata = {
  title: "Calendar",
};

/**
 * Public route — no password required (see src/middleware.ts's
 * PUBLIC_PATHS). Data lives in features/calendar/data.ts now (was inline
 * here) — extracted once Rohana's calendar made this a two-person dataset
 * instead of one.
 */
export default function CalendarPage() {
  return (
    <div>
      <Hero
        title="Calendar"
        label="Next vacation window"
        amount="Diwali · Nov 6"
        sub="12 days · AY 2026–27"
      />

      <div className="space-y-8 p-5 sm:p-8">
        <div className="rounded-2xl bg-accent-soft px-4 py-3.5">
          <div className="font-display text-sm font-bold text-accent">
            Family overlap &middot; both free at once
          </div>
          <div className="mt-1 text-sm text-ink">
            Wed 23 Dec 2026 &ndash; Sun 3 Jan 2027
          </div>
          <p className="mt-1.5 text-xs text-ink-soft">
            Ahaana&apos;s winter vacation falls entirely inside Rohana&apos;s
            much longer semester break (6 Dec &ndash; 10 Jan) &mdash; this is
            the one confirmed window where both are off school at the same time.
            Ahaana&apos;s summer overlaps Rohana&apos;s too, but Rohana&apos;s
            optional Special Terms (10 May&ndash;19 Jun and 21 Jun&ndash;31 Jul)
            can eat most of that if he enrolls in them &mdash; worth checking
            with him before booking anything in that window.
          </p>
        </div>

        <CalendarPersonToggle
          ahaanaTravelWindows={AHAANA_TRAVEL_WINDOWS}
          ahaanaCalendar={AHAANA_CALENDAR}
          rohanaTravelWindows={ROHANA_TRAVEL_WINDOWS}
          rohanaCalendar={ROHANA_CALENDAR}
        />

        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5 text-xs text-ink-soft">
            <span className="size-2.5 rounded-[3px] bg-positive" />
            Vacation — good for travel
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-soft">
            <span className="size-2.5 rounded-[3px] bg-line" />
            Holiday — single day off
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-soft">
            <span className="size-2.5 rounded-[3px] bg-negative" />
            Exam — avoid travel
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-soft">
            <span className="size-2.5 rounded-[3px] bg-accent" />
            School/university event
          </div>
        </div>

        <p className="text-xs leading-relaxed text-ink-faint">
          Ahaana&apos;s dates: Chatrabhuj Narsee School&apos;s official AY
          2026&ndash;27 calendar, filtered to Grade 8 and whole-school dates.
          Rohana&apos;s dates: NUS&apos;s official AY2026/2027 Academic
          Calendar, page 1 only &mdash; condensed to recess/reading weeks, exam
          periods, vacations, and public holidays, not every individual
          instructional week. Not yet dated by NUS:{" "}
          {ROHANA_TBC_HOLIDAYS.join(", ")} &mdash; re-check closer to the date.
          This page is public &mdash; anyone with the link can view it, no
          password needed. Everything else in this app requires one.
        </p>
      </div>
    </div>
  );
}
