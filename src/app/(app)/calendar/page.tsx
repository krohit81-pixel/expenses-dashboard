import type { Metadata } from "next";

import { Hero } from "@/components/ui/hero";
import { ROHANA_TBC_HOLIDAYS } from "@/features/calendar/data";
import { TravelCalendarSection } from "@/features/travel/components/TravelCalendarSection";
import { buildSchoolCalendarItems } from "@/features/travel/school-items";
import { buildTravelWindows } from "@/features/travel/travel-windows";
import { listCalendarEvents } from "@/services/CalendarEventService";
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
 *
 * v1.1.0: dropped the Hero's static "Next vacation window" label/amount
 * (a hardcoded Diwali date that would silently go stale) and the
 * "Family overlap" prose card (redundant with, and less legible than,
 * the windows strip + grid below it).
 */
export default async function CalendarPage() {
  const [trips, calendarEvents] = await Promise.all([
    listTrips(),
    listCalendarEvents(),
  ]);
  const schoolItems = buildSchoolCalendarItems();
  const travelWindows = buildTravelWindows();

  return (
    <div>
      <Hero title="Calendar" />

      <div className="space-y-8 p-5 sm:p-8">
        <TravelCalendarSection
          trips={trips}
          schoolItems={schoolItems}
          calendarEvents={calendarEvents}
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
          password needed, including any trip or event you add below
          (destination/dates/flight for a trip; title/dates/notes for an event).
          Everything else in this app requires one.
        </p>
      </div>
    </div>
  );
}
