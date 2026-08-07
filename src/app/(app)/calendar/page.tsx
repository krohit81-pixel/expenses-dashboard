import type { Metadata } from "next";

import { Hero } from "@/components/ui/hero";
import { TravelCalendarSection } from "@/features/travel/components/TravelCalendarSection";
import { buildSchoolCalendarItems } from "@/features/travel/school-items";
import { buildTravelWindows } from "@/features/travel/travel-windows";
import {
  expandRecurringOccurrences,
  widestRuleRange,
} from "@/lib/dates/recurring-calendar-events";
import { listCalendarEvents } from "@/services/CalendarEventService";
import { listRecurringCalendarEvents } from "@/services/RecurringCalendarEventService";
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
 *
 * v2.2.0: added recurring calendar events (finance.recurring_calendar_events)
 * — weekly-repeating rules, e.g. a class timetable. Occurrences are
 * expanded here, once, over the widest range any rule can ever produce
 * (widestRuleRange — each rule is bounded by its own start/end date, see
 * that migration's comment), then handed down as a flat list alongside
 * trips/calendarEvents; RecurringWeekGrid separately re-expands just the
 * current week client-side so it stays live without a reload as days
 * pass. See docs/00-current-state.md's "v2.0/v2.1 revamp" note — this is
 * unrelated to that finance-side Recurring page (recurring
 * transactions); same word, two independent features.
 */
export default async function CalendarPage() {
  const [trips, calendarEvents, recurringRules] = await Promise.all([
    listTrips(),
    listCalendarEvents(),
    listRecurringCalendarEvents(),
  ]);
  const schoolItems = buildSchoolCalendarItems();
  const travelWindows = buildTravelWindows();
  const ruleRange = widestRuleRange(recurringRules);
  const recurringOccurrences = ruleRange
    ? expandRecurringOccurrences(recurringRules, ruleRange.start, ruleRange.end)
    : [];

  return (
    <div>
      <Hero title="Calendar" />

      <div className="space-y-8 p-5 sm:p-8">
        <TravelCalendarSection
          trips={trips}
          schoolItems={schoolItems}
          calendarEvents={calendarEvents}
          recurringRules={recurringRules}
          recurringOccurrences={recurringOccurrences}
          travelWindows={travelWindows}
        />

        <p className="text-[11px] leading-relaxed text-ink-faint">
          This page is public — anyone with the link can view it, including any
          trip or event you add below. Everything else in this app requires a
          password.
        </p>
      </div>
    </div>
  );
}
