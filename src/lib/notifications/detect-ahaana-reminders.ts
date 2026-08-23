/**
 * Pure detector for Ahaana's mini-app activities (v3.4.0 Phase 2) —
 * kept in its own file rather than folded into detect-reminders.ts:
 * it detects from a different domain object
 * (AhaanaActivity/AhaanaOccurrence, not CalendarEvent/Trip/
 * RecurringCalendarEvent) and its candidates only ever target one
 * channel (web_push), never Telegram — see ReminderService's
 * runAhaanaReminders and registry.ts's own comment on why that split
 * matters.
 */

import type { AhaanaActivity } from "@/services/AhaanaActivityService";
import type { AhaanaActivityLog } from "@/services/AhaanaActivityLogService";
import { expandAhaanaOccurrences } from "@/lib/dates/ahaana-activities";
import { getWeekDates } from "@/lib/dates/calendar-grid";
import type { ReminderCandidate } from "@/lib/notifications/detect-reminders";

/** Whole days from `today` to `date` (both "YYYY-MM-DD"), positive when `date` is in the future — same UTC-based convention as detect-reminders.ts's own daysUntil. */
function daysUntil(today: string, date: string): number {
  const from = new Date(`${today}T00:00:00Z`);
  const to = new Date(`${date}T00:00:00Z`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** "15 Oct" — shorter than detect-reminders.ts's formatDate (no year) since this is a quick on-device notification, not a Telegram message someone might read out of context weeks later. */
function formatShortDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function formatTime12h(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function daysBeforeLabel(days: number): string {
  return days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"} before`;
}

/**
 * Day-based only, mirroring the main calendar's own day-based
 * detectors — an hour-based option wasn't asked for here (her
 * activities all have a real start_time already, but "remind N hours
 * before" specifically wasn't part of this request, unlike the main
 * calendar's own remind_lead_hours). `lookaheadDays` bounds how far
 * ahead expandAhaanaOccurrences needs to expand to catch the longest
 * remindLeadDays value in play — same reasoning as
 * ReminderService's RECURRING_LOOKAHEAD_DAYS.
 */
export function detectAhaanaActivityReminders(
  activities: AhaanaActivity[],
  today: string,
  lookaheadDays: number,
): ReminderCandidate[] {
  const enabledActivities = activities.filter(
    (a) => a.active && a.remindEnabled,
  );
  if (enabledActivities.length === 0) return [];

  const rangeEnd = addDays(today, lookaheadDays);
  const occurrences = expandAhaanaOccurrences(
    enabledActivities,
    today,
    rangeEnd,
  );
  const activityById = new Map(enabledActivities.map((a) => [a.id, a]));

  const candidates: ReminderCandidate[] = [];
  for (const occurrence of occurrences) {
    const activity = activityById.get(occurrence.activityId);
    if (!activity) continue;
    if (daysUntil(today, occurrence.date) !== activity.remindLeadDays) {
      continue;
    }
    candidates.push({
      eventType: "ahaana_activity",
      eventKey: `ahaana_activity:${activity.id}:${occurrence.date}`,
      leadTimeDays: activity.remindLeadDays,
      leadTimeUnit: "days",
      title: occurrence.title,
      body: `${formatShortDate(occurrence.date)} at ${formatTime12h(occurrence.startTime)} (${daysBeforeLabel(activity.remindLeadDays)})`,
    });
  }
  return candidates;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * v3.4.0 Phase 3 — the weekly summary sent to the parent's Telegram
 * (opposite direction from detectAhaanaActivityReminders above: this
 * one only ever targets `telegram`, never `web_push` — see
 * ReminderService.runReminders' explicit channel list). Only ever
 * produces a candidate on Sunday, the last day of this app's
 * Monday-start week convention (getWeekDates, lib/dates/calendar-grid.ts)
 * — that keeps the report a genuine "week just ended" summary rather
 * than a rolling window, and `today` (Sunday)'s own `getWeekDates`
 * call already returns exactly that week's Mon-Sun range with no
 * extra date math needed. `force` (the manual "Send weekly report
 * now" button's own use, mirroring RunRemindersButton's role for the
 * day-based reminders) bypasses the Sunday gate — notification_log's
 * own dedupe (keyed by the week's Monday date) still prevents a
 * duplicate real send for a week already reported on.
 *
 * Produces nothing at all if nothing was scheduled that week (e.g.
 * before any activity existed yet) — there's no meaningful "0 of 0"
 * report worth sending.
 */
export function detectAhaanaWeeklyReport(
  activities: AhaanaActivity[],
  logs: AhaanaActivityLog[],
  today: string,
  options: { force?: boolean } = {},
): ReminderCandidate[] {
  const isSunday = new Date(`${today}T00:00:00Z`).getUTCDay() === 0;
  if (!isSunday && !options.force) return [];

  const [weekStart, , , , , , weekEnd] = getWeekDates(today);
  const activeActivities = activities.filter((a) => a.active);
  const occurrences = expandAhaanaOccurrences(
    activeActivities,
    weekStart,
    weekEnd,
  );
  if (occurrences.length === 0) return [];

  const logByKey = new Map(
    logs.map((log) => [`${log.activityId}-${log.occurrenceDate}`, log]),
  );
  const completedCount = occurrences.filter((o) =>
    logByKey.has(`${o.activityId}-${o.date}`),
  ).length;

  const lines: string[] = [
    `✅ ${completedCount} of ${occurrences.length} sessions completed`,
  ];
  for (const occurrence of occurrences) {
    const log = logByKey.get(`${occurrence.activityId}-${occurrence.date}`);
    const dateLabel = formatShortDate(occurrence.date);
    if (!log) {
      lines.push(`⏳ ${occurrence.title} (${dateLabel}) — not logged`);
      continue;
    }
    lines.push(
      `${occurrence.title} (${dateLabel})${log.coveredNotes ? `: ${log.coveredNotes}` : ""}`,
    );
    if (log.nextNotes) {
      lines.push(`  → Next: ${log.nextNotes}`);
    }
  }

  return [
    {
      eventType: "ahaana_weekly_report",
      eventKey: `ahaana_weekly_report:${weekStart}`,
      leadTimeDays: 0,
      leadTimeUnit: "days",
      title: "Ahaana's Weekly Report",
      body: lines.join("\n"),
    },
  ];
}
