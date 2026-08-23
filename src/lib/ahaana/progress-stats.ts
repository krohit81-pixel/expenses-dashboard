/**
 * Pure, testable stats behind the parent-facing "Ahaana's Progress"
 * page (v3.4.0 Phase 3) — kept separate from any DB/React code so it
 * can be fixtured and unit-tested the same way
 * expandAhaanaOccurrences/detectAhaanaWeeklyReport are, and so the page
 * component itself stays a thin "fetch real rows, hand them to a pure
 * function, render the result" shell.
 */

import type { AhaanaActivity } from "@/services/AhaanaActivityService";
import type { AhaanaActivityLog } from "@/services/AhaanaActivityLogService";
import { expandAhaanaOccurrences } from "@/lib/dates/ahaana-activities";
import { getWeekDates } from "@/lib/dates/calendar-grid";

export interface AhaanaWeeklyStat {
  /** Monday of this week, "YYYY-MM-DD" — also the identity used for the x-axis label. */
  weekStart: string;
  weekEnd: string;
  scheduled: number;
  completed: number;
  /** 0-100, rounded — 0 when nothing was scheduled that week (not NaN/Infinity from a 0/0 divide). */
  completionRate: number;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * One stat row per week, oldest first, for the `weeksBack` weeks up to
 * and including the week containing `asOf` — e.g. `weeksBack: 6` gives
 * a 6-bar chart of this week and the 5 before it. Only counts `active`
 * activities (same filter detectAhaanaWeeklyReport uses) — a
 * deactivated activity's past occurrences still happened, but a
 * currently-inactive one shouldn't visually drag down "how is this
 * *going*" for weeks where it was never really in play... actually
 * simpler and more honest: activities don't un-happen, so this counts
 * every occurrence that existed in each week's window regardless of
 * the activity's *current* active flag, matching what the weekly
 * report itself would have said back when it was sent.
 */
export function computeAhaanaWeeklyStats(
  activities: AhaanaActivity[],
  logs: AhaanaActivityLog[],
  weeksBack: number,
  asOf: string = new Date().toISOString().slice(0, 10),
): AhaanaWeeklyStat[] {
  const [thisWeekStart] = getWeekDates(asOf);
  const logByKey = new Set(
    logs.map((log) => `${log.activityId}-${log.occurrenceDate}`),
  );

  const stats: AhaanaWeeklyStat[] = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const weekStart = addDays(thisWeekStart, -7 * i);
    const weekEnd = addDays(weekStart, 6);
    const occurrences = expandAhaanaOccurrences(activities, weekStart, weekEnd);
    const completed = occurrences.filter((o) =>
      logByKey.has(`${o.activityId}-${o.date}`),
    ).length;

    stats.push({
      weekStart,
      weekEnd,
      scheduled: occurrences.length,
      completed,
      completionRate:
        occurrences.length === 0
          ? 0
          : Math.round((completed / occurrences.length) * 100),
    });
  }

  return stats;
}

export interface AhaanaRecentLogEntry {
  activityId: string;
  title: string;
  category: AhaanaActivity["category"];
  date: string;
  coveredNotes: string | null;
  nextNotes: string | null;
}

/**
 * The most recent `limit` logged sessions, newest first, joined with
 * the activity's title/category for display — the "intel" list on the
 * progress page (what she actually covered, and what she flagged for
 * next). Occurrence title/category come from the activity as it is
 * *now*, same simplification detectAhaanaWeeklyReport's own occurrence
 * lookup makes (activities are edited rarely; a renamed activity
 * showing its new name against an old log entry is an acceptable
 * trade for not needing to snapshot the title at log time).
 */
export function buildAhaanaRecentLogEntries(
  activities: AhaanaActivity[],
  logs: AhaanaActivityLog[],
  limit: number,
): AhaanaRecentLogEntry[] {
  const activityById = new Map(activities.map((a) => [a.id, a]));

  return logs
    .filter((log) => activityById.has(log.activityId))
    .sort((a, b) => b.occurrenceDate.localeCompare(a.occurrenceDate))
    .slice(0, limit)
    .map((log) => {
      // Non-null: filtered above.
      const activity = activityById.get(log.activityId) as AhaanaActivity;
      return {
        activityId: log.activityId,
        title: activity.title,
        category: activity.category,
        date: log.occurrenceDate,
        coveredNotes: log.coveredNotes,
        nextNotes: log.nextNotes,
      };
    });
}
