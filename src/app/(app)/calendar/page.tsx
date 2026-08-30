import type { Metadata } from "next";
import { cookies, headers } from "next/headers";

import { Hero } from "@/components/ui/hero";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/access-gate";
import { ThemeToggleButton } from "@/features/settings/ThemeToggle";
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
 *
 * v3.4.13: computes isLoggedIn (a real check of the main app_access
 * cookie, not a redirect — this page stays public either way) and
 * hands it down to the event edit modal, which uses it to enable/
 * disable its "Send reminder now" button. This page itself doesn't
 * need the cookie for anything else; see AddEventModal's own comment
 * for why the button needs this at all.
 */
export default async function CalendarPage() {
  const [trips, calendarEvents, recurringRules, cookieStore, headerList] =
    await Promise.all([
      listTrips(),
      listCalendarEvents(),
      listRecurringCalendarEvents(),
      cookies(),
      headers(),
    ]);
  const isLoggedIn = verifyAccessToken(
    cookieStore.get(ACCESS_COOKIE_NAME)?.value,
  );
  const schoolItems = buildSchoolCalendarItems();
  const travelWindows = buildTravelWindows();
  const ruleRange = widestRuleRange(recurringRules);
  const recurringOccurrences = ruleRange
    ? expandRecurringOccurrences(recurringRules, ruleRange.start, ruleRange.end)
    : [];

  // v3.6.4 — the real request host, so the subscribe link below works
  // unchanged on production, a Vercel preview deploy, or localhost,
  // with no hardcoded domain. webcal:// is what makes tapping the link
  // on an Apple device open Calendar.app's own "Add Subscription"
  // sheet directly, rather than just downloading a file.
  const host = headerList.get("host") ?? "";
  const feedUrlHttps = `https://${host}/api/calendar.ics`;
  const feedUrlWebcal = `webcal://${host}/api/calendar.ics`;

  return (
    <div>
      <Hero title="Calendar" topRightAction={<ThemeToggleButton />} />

      <div className="space-y-8 p-5 sm:p-8">
        <TravelCalendarSection
          trips={trips}
          schoolItems={schoolItems}
          calendarEvents={calendarEvents}
          recurringRules={recurringRules}
          recurringOccurrences={recurringOccurrences}
          travelWindows={travelWindows}
          isLoggedIn={isLoggedIn}
        />

        <div className="rounded-[20px] bg-surface p-5 shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <h2 className="mb-1.5 font-display text-[13px] font-bold text-ink">
            Subscribe in Apple Calendar
          </h2>
          <p className="mb-3 text-[11.5px] leading-relaxed text-ink-faint">
            Adds every trip, school date, and class on this page to your own
            calendar app, and keeps it updated automatically — no re-importing
            needed when something changes here.
          </p>
          <a
            href={feedUrlWebcal}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 font-display text-xs font-bold text-white"
          >
            Subscribe
          </a>
          <p className="mt-3 break-all text-[10.5px] text-ink-faint">
            Other apps (Google Calendar, Outlook): add a calendar from URL using{" "}
            {feedUrlHttps}
          </p>
        </div>

        <p className="text-[11px] leading-relaxed text-ink-faint">
          This page is public — anyone with the link can view it, including any
          trip or event you add below. Everything else in this app requires a
          password.
        </p>
      </div>
    </div>
  );
}
