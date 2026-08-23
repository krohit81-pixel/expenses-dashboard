import type { Metadata } from "next";

import { listAhaanaActivities } from "@/services/AhaanaActivityService";
import { listAhaanaActivityLogs } from "@/services/AhaanaActivityLogService";
import { expandAhaanaOccurrences } from "@/lib/dates/ahaana-activities";
import { getWeekDates, todayISODate } from "@/lib/dates/calendar-grid";
import { WeeklyScheduleView } from "@/features/ahaana/components/WeeklyScheduleView";

export const metadata: Metadata = {
  title: "This Week",
};

/**
 * v3.4.0 — Ahaana's own weekly schedule: this week's occurrences from
 * her recurring activities (expandAhaanaOccurrences, same pattern
 * WeekScheduleGrid already uses for the family calendar), each either
 * awaiting a "mark complete + notes" entry or already logged. Always
 * the CURRENT week — no navigation to other weeks in this first pass,
 * matching the household's own framing ("a weekly schedule... so you
 * get the vision and overall picture," not a full historical log to
 * browse here; that's what the parent-facing progress page is for).
 */
export default async function AhaanaWeeklyPage() {
  const weekDates = getWeekDates(todayISODate());
  const [activities, logs] = await Promise.all([
    listAhaanaActivities(),
    listAhaanaActivityLogs(weekDates[0], weekDates[6]),
  ]);

  const activeActivities = activities.filter((a) => a.active);
  const occurrences = expandAhaanaOccurrences(
    activeActivities,
    weekDates[0],
    weekDates[6],
  );

  return (
    <WeeklyScheduleView
      weekDates={weekDates}
      occurrences={occurrences}
      logs={logs}
    />
  );
}
