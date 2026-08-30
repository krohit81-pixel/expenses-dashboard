import { NextResponse } from "next/server";
import ical from "ical-generator";

import { listCalendarEvents } from "@/services/CalendarEventService";
import { listRecurringCalendarEvents } from "@/services/RecurringCalendarEventService";
import { listTrips } from "@/services/TripService";
import { buildSchoolCalendarItems } from "@/features/travel/school-items";
import { buildCalendarFeedEvents } from "@/lib/ical/build-calendar-feed";

// ical-generator constructs real Date objects and does its own text
// serialization -- no Edge-incompatible APIs, but Node is the
// established default runtime for this app's other route handlers.
export const runtime = "nodejs";

/**
 * v3.6.4 — a live, subscribable iCal feed of everything shown on the
 * public /calendar page (trips, the static Ahaana/Rohana school
 * calendars, manual events, recurring class rules), for Apple/Google
 * Calendar's own "subscribe from URL" flow — see
 * lib/ical/build-calendar-feed.ts for how each source becomes a VEVENT.
 *
 * Public route (see middleware.ts's PUBLIC_PATHS), same reasoning
 * /calendar itself is already public: a calendar app's background
 * refresh has no way to carry the access-gate cookie, and this feed
 * contains nothing /calendar doesn't already show anyone with the
 * link.
 */
export async function GET() {
  const [trips, calendarEvents, recurringRules] = await Promise.all([
    listTrips(),
    listCalendarEvents(),
    listRecurringCalendarEvents(),
  ]);
  const schoolItems = buildSchoolCalendarItems();

  const calendar = ical({
    name: "Atlas Calendar",
    // Deliberately NOT setting a calendar-level `timezone` here --
    // confirmed (by generating a real feed and diffing) that
    // ical-generator uses it to reformat BOTH DTSTAMP and every
    // recurring event's RRULE UNTIL into a bare local timestamp with
    // no trailing "Z", which RFC 5545 requires for both (UNTIL
    // specifically MUST be UTC whenever DTSTART carries a TZID, which
    // every recurring event here does). Each timed event still
    // declares its own `timezone: "Asia/Kolkata"` (see
    // build-calendar-feed.ts) -- that's what puts the correct
    // `DTSTART;TZID=Asia/Kolkata:...` on those events, independent of
    // this calendar-level setting.
    prodId: { company: "Atlas", product: "Calendar Feed", language: "EN" },
    // A refresh-interval hint -- Apple Calendar applies its own
    // background-refresh cadence regardless, but it's a harmless,
    // standard thing to declare.
    ttl: 6 * 60 * 60,
    events: buildCalendarFeedEvents(
      trips,
      schoolItems,
      calendarEvents,
      recurringRules,
    ),
  });

  return new NextResponse(calendar.toString(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
    },
  });
}
