import "server-only";

import { listCalendarEvents } from "@/services/CalendarEventService";
import { listTrips } from "@/services/TripService";
import { listRecurringCalendarEvents } from "@/services/RecurringCalendarEventService";
import {
  alreadySent,
  recordFailed,
  recordSent,
  type NotificationLogKey,
} from "@/services/NotificationLogService";
import { getSendTarget } from "@/services/NotificationChannelService";
import { listChannelTypes, getProvider } from "@/lib/notifications/registry";
import { buildSchoolCalendarItems } from "@/features/travel/school-items";
import {
  detectCalendarEventReminders,
  detectRecurringEventReminders,
  detectSchoolCalendarReminders,
  detectTripReminders,
  type ReminderCandidate,
} from "@/lib/notifications/detect-reminders";

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

/**
 * The reminder engine (v3.2.0, gained a 4th source in v3.2.1) — ties
 * the pure detectors together with real data and actually sends.
 * Deliberately thin: fetch real rows via the existing list*() service
 * functions (no new queries duplicating due-date logic) plus the
 * static school calendars, run them through the pure detectors, dedupe
 * against notification_log, send via whichever channels are linked.
 *
 * `asOf` defaults to today but is overridable for testing/backfill —
 * same reasoning as RecurringTransactionService.generateDueTransactions'
 * own `asOf` parameter.
 */
export async function runReminders(
  asOf: string = new Date().toISOString().slice(0, 10),
): Promise<ReminderRunResult> {
  const [events, trips, recurringRules] = await Promise.all([
    listCalendarEvents(),
    listTrips(),
    listRecurringCalendarEvents(),
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
  ];

  const result: ReminderRunResult = {
    candidates: candidates.length,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  if (candidates.length === 0) {
    return result;
  }

  const channelTypes = listChannelTypes();

  for (const candidate of candidates) {
    for (const channelType of channelTypes) {
      const key: NotificationLogKey = {
        eventType: candidate.eventType,
        eventKey: candidate.eventKey,
        leadTimeDays: candidate.leadTimeDays,
        channelType,
      };

      // Sequential, not Promise.all — single-owner, a handful of
      // candidates per run; this keeps it simple and avoids racing
      // duplicate sends against notification_log's own dedupe check,
      // same reasoning as applyCycleTags' loop.
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
