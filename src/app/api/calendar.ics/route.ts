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
    // ical-generator formats DTSTAMP using the RUNNING PROCESS's own
    // local Date getters whenever this is set, not a real IANA
    // conversion -- correct by coincidence in a sandbox whose system
    // timezone happens to be Asia/Calcutta, wrong (silently shifted)
    // on Vercel's actual UTC runtime. Every timed event uses floating
    // local time instead of a declared timezone for the same root
    // cause -- see wallClockDateTime's own comment in
    // build-calendar-feed.ts for the full story.
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
