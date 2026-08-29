import "server-only";

import {
  getCalendarEvent,
  listCalendarEvents,
} from "@/services/CalendarEventService";
import { listTrips } from "@/services/TripService";
import { listRecurringCalendarEvents } from "@/services/RecurringCalendarEventService";
import {
  alreadySent,
  recordFailed,
  recordSent,
  type NotificationLogKey,
} from "@/services/NotificationLogService";
import { getSendTarget } from "@/services/NotificationChannelService";
import { getProvider } from "@/lib/notifications/registry";
import { buildSchoolCalendarItems } from "@/features/travel/school-items";
import {
  buildCalendarEventManualReminder,
  detectCalendarEventHourlyReminders,
  detectCalendarEventReminders,
  detectRecurringEventHourlyReminders,
  detectRecurringEventReminders,
  detectSchoolCalendarReminders,
  detectTripReminders,
  type ReminderCandidate,
} from "@/lib/notifications/detect-reminders";
import {
  detectAhaanaActivityReminders,
  detectAhaanaActivityHourlyReminders,
  detectAhaanaWeeklyReport,
} from "@/lib/notifications/detect-ahaana-reminders";
import { listAhaanaActivities } from "@/services/AhaanaActivityService";
import { listAhaanaActivityLogs } from "@/services/AhaanaActivityLogService";
import { getWeekDates } from "@/lib/dates/calendar-grid";
import type { ChannelType } from "@/lib/notifications/provider";

export interface ReminderRunResult {
  candidates: number;
  sent: number;
  skipped: number;
  failed: number;
}

/** How far ahead a recurring rule's occurrences need expanding to catch every possible remindLeadDays value in play — generous fixed bound rather than computing the real max from the data, since the cost of expanding a few extra days is negligible and it means a newly-raised lead time never silently falls outside the window. */
const RECURRING_LOOKAHEAD_DAYS = 14;

/** v3.2.1 — fixed lead time for every entry in the static school calendars (household request: "all of them, 1 day before"). Not user-configurable since there's no per-item toggle for static data-file rows — see detectSchoolCalendarReminders' own comment. */
const SCHOOL_CALENDAR_LEAD_DAYS = 1;

/** v3.2.2 — how far ahead an hour-based recurring occurrence search needs to expand. Only needs to cover the longest hour lead time in play (< 24h, given the 3/4-hour UI options) plus a day of IST/UTC slack — see detectRecurringEventHourlyReminders' own comment. */
const RECURRING_HOURLY_LOOKAHEAD_DAYS = 2;

/** v3.4.0 Phase 2 — same reasoning as RECURRING_LOOKAHEAD_DAYS, for Ahaana's own recurring activities. */
const AHAANA_LOOKAHEAD_DAYS = 14;

/** v3.4.3 — same reasoning as RECURRING_HOURLY_LOOKAHEAD_DAYS, for Ahaana's own hour-based activity reminders. */
const AHAANA_HOURLY_LOOKAHEAD_DAYS = 2;

/**
 * The actual "dedupe, find a channel, send, record" loop — shared by
 * every runX function below so none of them drift in how a candidate
 * becomes a real send. Sequential, not Promise.all: single-owner, a
 * handful of candidates per run; this keeps it simple and avoids
 * racing duplicate sends against notification_log's own dedupe check,
 * same reasoning as applyCycleTags' loop.
 *
 * `channelTypes` is a required, explicit list, not a default of
 * "every registered channel" — v3.4.0 Phase 2 added `web_push`
 * (targeting Ahaana's device specifically) alongside `telegram`
 * (targeting the household), and a candidate from one domain must
 * never fire at the other's channel. See registry.ts's own comment on
 * `listChannelTypes()` for why that default isn't used here anymore.
 */
async function sendCandidates(
  candidates: ReminderCandidate[],
  channelTypes: ChannelType[],
): Promise<ReminderRunResult> {
  const result: ReminderRunResult = {
    candidates: candidates.length,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  if (candidates.length === 0) {
    return result;
  }

  for (const candidate of candidates) {
    for (const channelType of channelTypes) {
      const key: NotificationLogKey = {
        eventType: candidate.eventType,
        eventKey: candidate.eventKey,
        leadTimeDays: candidate.leadTimeDays,
        leadTimeUnit: candidate.leadTimeUnit,
        channelType,
      };

      if (await alreadySent(key)) {
        result.skipped += 1;
        continue;
      }

      const provider = getProvider(channelType);
      if (!provider.isConfigured()) {
        // Not an error — this channel just isn't set up (no
        // TELEGRAM_BOT_TOKEN, say). Nothing to log; there was never a
        // real send attempt.
        continue;
      }

      const target = await getSendTarget(channelType);
      if (!target) {
        // Configured at the env level but not linked by the owner yet
        // (no chat ID saved/enabled in Settings) — also not an error.
        continue;
      }

      const sendResult = await provider.send(target, {
        title: candidate.title,
        body: candidate.body,
      });

      if (sendResult.ok) {
        await recordSent(key, sendResult.providerMessageId);
        result.sent += 1;
      } else {
        await recordFailed(key, sendResult.error ?? "Unknown error");
        result.failed += 1;
      }
    }
  }

  return result;
}

/**
 * The day-based reminder engine (v3.2.0, gained a 4th source in
 * v3.2.1) — ties the day-based pure detectors together with real data
 * and actually sends. Deliberately thin: fetch real rows via the
 * existing list*() service functions (no new queries duplicating
 * due-date logic) plus the static school calendars, run them through
 * the pure detectors, dedupe against notification_log, send via
 * whichever channels are linked.
 *
 * Driven by the slower of the two Vercel Cron schedules
 * (`/api/cron/reminders`, every 4 hours) — see runHourlyReminders for
 * the hour-based counterpart on its own, more frequent schedule
 * (`/api/cron/reminders-hourly`, v3.2.2).
 *
 * `asOf` defaults to today but is overridable for testing/backfill —
 * same reasoning as RecurringTransactionService.generateDueTransactions'
 * own `asOf` parameter.
 */
export async function runReminders(
  asOf: string = new Date().toISOString().slice(0, 10),
): Promise<ReminderRunResult> {
  const [weekStart, , , , , , weekEnd] = getWeekDates(asOf);
  const [events, trips, recurringRules, ahaanaActivities, ahaanaLogs] =
    await Promise.all([
      listCalendarEvents(),
      listTrips(),
      listRecurringCalendarEvents(),
      // v3.4.0 Phase 3 — fetched every run (not just Sunday) since this
      // is a cheap read and detectAhaanaWeeklyReport itself is the one
      // that gates on day-of-week; keeps this function's own fetch list
      // uniform rather than conditionally skipping two calls 6 days a
      // week for a negligible saving.
      listAhaanaActivities(),
      listAhaanaActivityLogs(weekStart, weekEnd),
    ]);

  const candidates: ReminderCandidate[] = [
    ...detectCalendarEventReminders(events, asOf),
    ...detectTripReminders(trips, asOf),
    ...detectRecurringEventReminders(
      recurringRules,
      asOf,
      RECURRING_LOOKAHEAD_DAYS,
    ),
    // buildSchoolCalendarItems() is pure/synchronous (in-code data, no
    // DB round trip) — safe to call inline here alongside the three
    // real async list*() fetches above.
    ...detectSchoolCalendarReminders(
      buildSchoolCalendarItems(),
      asOf,
      SCHOOL_CALENDAR_LEAD_DAYS,
    ),
    // v3.4.0 Phase 3 — the parent's weekly Ahaana report, riding this
    // same 4-hourly cron rather than a dedicated one (see the
    // add_ahaana_weekly_report_event_type migration's own comment for
    // why); only ever actually produces a candidate on Sunday.
    ...detectAhaanaWeeklyReport(ahaanaActivities, ahaanaLogs, asOf),
  ];

  return sendCandidates(candidates, ["telegram"]);
}

/**
 * v3.4.0 Phase 3 — manual "Send weekly report now" trigger (Settings
 * page), mirroring how runReminders/runAhaanaReminders are themselves
 * just plain functions the cron routes call — this one instead bypasses
 * the Sunday gate via detectAhaanaWeeklyReport's own `force` option, so
 * a household member can pull the current week's report on demand
 * without waiting for Sunday. notification_log's existing dedupe
 * (keyed by the week's Monday date) still prevents a second real send
 * for a week already reported on — a repeat click just shows 0 sent,
 * same as clicking "Run reminders now" twice in a row today.
 */
export async function runAhaanaWeeklyReportNow(
  asOf: string = new Date().toISOString().slice(0, 10),
): Promise<ReminderRunResult> {
  const [weekStart, , , , , , weekEnd] = getWeekDates(asOf);
  const [activities, logs] = await Promise.all([
    listAhaanaActivities(),
    listAhaanaActivityLogs(weekStart, weekEnd),
  ]);

  const candidates = detectAhaanaWeeklyReport(activities, logs, asOf, {
    force: true,
  });

  return sendCandidates(candidates, ["telegram"]);
}

/**
 * v3.2.2 — the hour-based reminder engine, run on its own, more
 * frequent Vercel Cron schedule (`/api/cron/reminders-hourly`) than
 * runReminders' 4-hourly one, since an "N hours before" reminder needs
 * tighter timing precision than a day-level one does. Only covers the
 * two sources that carry a real time of day: calendar events (once an
 * optional startTime is set) and recurring calendar event rules
 * (always have one). Trips and the static school calendars have no
 * hour-based option — see the migration and detect-reminders.ts
 * comments for why.
 *
 * `nowIso` defaults to the real current instant but is overridable for
 * testing — same reasoning as runReminders' own `asOf` parameter,
 * just a full instant instead of a date since hour-of-day is the
 * whole point here.
 */
export async function runHourlyReminders(
  nowIso: string = new Date().toISOString(),
): Promise<ReminderRunResult> {
  const [events, recurringRules] = await Promise.all([
    listCalendarEvents(),
    listRecurringCalendarEvents(),
  ]);

  const candidates: ReminderCandidate[] = [
    ...detectCalendarEventHourlyReminders(events, nowIso),
    ...detectRecurringEventHourlyReminders(
      recurringRules,
      nowIso,
      RECURRING_HOURLY_LOOKAHEAD_DAYS,
    ),
  ];

  return sendCandidates(candidates, ["telegram"]);
}

/**
 * v3.4.0 Phase 2 — Ahaana's own reminder engine, run on its own Vercel
 * Cron route (`/api/cron/ahaana-reminders`) and targeting `web_push`
 * only — never `telegram`, so her activity reminders only ever reach
 * her device, never the household Telegram group (and vice versa: her
 * device never receives the household's own calendar/trip/school
 * reminders either, since those explicitly target `["telegram"]`
 * above).
 *
 * v3.4.3 — takes a full instant (`nowIso`), not just a date, now that
 * an hour-based option exists alongside the day-based one (same
 * "day-based cares about the date, hour-based cares about the instant"
 * split runHourlyReminders' own `nowIso` follows). The cron schedule
 * behind this route was tightened from every 4 hours to every 15
 * minutes in the same pass, matching runHourlyReminders' own cadence
 * — a "1 hour before" reminder needs that same tighter precision an
 * every-4-hours tick can't provide.
 */
export async function runAhaanaReminders(
  nowIso: string = new Date().toISOString(),
): Promise<ReminderRunResult> {
  const asOf = nowIso.slice(0, 10);
  const activities = await listAhaanaActivities();

  const candidates: ReminderCandidate[] = [
    ...detectAhaanaActivityReminders(activities, asOf, AHAANA_LOOKAHEAD_DAYS),
    ...detectAhaanaActivityHourlyReminders(
      activities,
      nowIso,
      AHAANA_HOURLY_LOOKAHEAD_DAYS,
    ),
  ];

  return sendCandidates(candidates, ["web_push"]);
}

export interface SendReminderNowResult {
  ok: boolean;
  error?: string;
}

/**
 * v3.4.13 — the "Send reminder now" button in the calendar event edit
 * modal: a genuinely manual, on-demand Telegram send for one specific
 * event, independent of remindEnabled/remindLeadDays entirely — a
 * household member might want this sent right now regardless of
 * whether an automatic reminder already fired, or ever will (the
 * event might not even have reminders enabled at all).
 *
 * Deliberately bypasses sendCandidates' notification_log dedupe check
 * rather than reusing it: that dedupe is keyed on
 * (eventType, eventKey, leadTimeDays, leadTimeUnit, channelType), and
 * the automatic detector's own key for this same event
 * (`calendar_event:{id}`) would make a second manual click silently
 * skip ("already sent") — exactly backwards from a manual trigger,
 * which should fire every time it's clicked. Still recorded to
 * notification_log afterward for the same audit-trail reasoning every
 * other send is (see NotificationLogService's own comment), just under
 * a key that includes the send instant so it can never collide with
 * either the automatic reminder's key or an earlier manual send for
 * the same event.
 *
 * No access check here — that's the caller's job
 * (sendCalendarEventReminderNowAction verifies the main app_access
 * cookie before ever calling this), since this is a plain service
 * function other callers may reuse without a cookie in scope.
 */
export async function sendCalendarEventReminderNow(
  eventId: string,
): Promise<SendReminderNowResult> {
  const event = await getCalendarEvent(eventId);
  if (!event) {
    return { ok: false, error: "That event no longer exists." };
  }

  const provider = getProvider("telegram");
  if (!provider.isConfigured()) {
    return {
      ok: false,
      error:
        "TELEGRAM_BOT_TOKEN isn't set on the server yet — add it as an environment variable, then redeploy.",
    };
  }

  const target = await getSendTarget("telegram");
  if (!target) {
    return {
      ok: false,
      error: "No Telegram chat ID is set up yet — add one in Settings first.",
    };
  }

  const { title, body } = buildCalendarEventManualReminder(event);
  const sendResult = await provider.send(target, { title, body });

  const key: NotificationLogKey = {
    eventType: "calendar_event",
    eventKey: `calendar_event:manual:${event.id}:${Date.now()}`,
    leadTimeDays: 0,
    leadTimeUnit: "days",
    channelType: "telegram",
  };

  if (sendResult.ok) {
    await recordSent(key, sendResult.providerMessageId);
    return { ok: true };
  }

  await recordFailed(key, sendResult.error ?? "Unknown error");
  return {
    ok: false,
    error: sendResult.error ?? "Send failed for an unknown reason",
  };
}
