import type { Metadata } from "next";

import { Hero } from "@/components/ui/hero";
import { ROHANA_TBC_HOLIDAYS } from "@/features/calendar/data";
import { TravelCalendarSection } from "@/features/travel/components/TravelCalendarSection";
import { buildSchoolCalendarItems } from "@/features/travel/school-items";
import { buildTravelWindows } from "@/features/travel/travel-windows";
import { listTrips } from "@/services/TripService";

export const metadata: Metadata = {
  title: "Calendar",
};

/**
 * Public route — no password required (see src/middleware.ts's
 * PUBLIC_PATHS). Data lives in features/calendar/data.ts (Ahaana/Rohana's
 * static school calendars) and, as of v1.0, finance.trips (booked
 * travel, via TripService) — both shown together here.
 *
 * v1.0, Travel-in-Calendar: booked trips were originally scoped as their
 * own "Travel" tab, then merged into this page instead (grid at the top,
 * a merged detailed events list, an add-a-trip section below). Kept
 * public rather than gating travel behind the access-gate password —
 * a deliberate call, not an oversight: see the footnote paragraph below
 * for what that means for anyone with this link.
 */
export default async function CalendarPage() {
  const trips = await listTrips();
  const schoolItems = buildSchoolCalendarItems();
  const travelWindows = buildTravelWindows();

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
            can eat most of that if she enrolls in them &mdash; worth checking
            with her before booking anything in that window.
          </p>
        </div>

        <TravelCalendarSection
          trips={trips}
          schoolItems={schoolItems}
          travelWindows={travelWindows}
        />

        <p className="text-xs leading-relaxed text-ink-faint">
          Ahaana&apos;s dates: Chatrabhuj Narsee School&apos;s official AY
          2026&ndash;27 calendar, filtered to Grade 8 and whole-school dates.
          Rohana&apos;s dates: NUS&apos;s official AY2026/2027 Academic
          Calendar, page 1 only &mdash; condensed to recess/reading weeks, exam
          periods, vacations, and public holidays, not every individual
          instructional week. Not yet dated by NUS:{" "}
          {ROHANA_TBC_HOLIDAYS.join(", ")} &mdash; re-check closer to the date.
          This page is public &mdash; anyone with the link can view it, no
          password needed, including any trip you add below (destination, dates,
          and flight name). Everything else in this app requires one.
        </p>
      </div>
    </div>
  );
}
