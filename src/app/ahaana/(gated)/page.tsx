import type { Metadata } from "next";

import { listAhaanaActivities } from "@/services/AhaanaActivityService";
import { listAhaanaActivityLogs } from "@/services/AhaanaActivityLogService";
import {
  expandAhaanaOccurrences,
  getAhaanaWeekDates,
} from "@/lib/dates/ahaana-activities";
import { serverEnv } from "@/lib/env/server";
import { WeeklyScheduleView } from "@/features/ahaana/components/WeeklyScheduleView";
import { EnablePushButton } from "@/features/ahaana/components/EnablePushButton";

export const metadata: Metadata = {
  title: "Dashboard",
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
 *
 * v3.4.8 — renamed "This Week" -> "Dashboard" (now one of two tabs,
 * alongside "Log Activity" — see `(gated)/layout.tsx`), and switched
 * to `getAhaanaWeekDates` (Sunday-start) instead of the household
 * calendar's own Monday-start `getWeekDates` — her own explicit
 * request ("new week starts at Sunday"), scoped to just this page; the
 * parent-facing weekly report/progress page stays Monday-start on
 * purpose (that's the household's own convention, not hers).
 */
export default async function AhaanaWeeklyPage() {
  const weekDates = getAhaanaWeekDates();
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
    <div className="space-y-5">
      <EnablePushButton vapidPublicKey={serverEnv.VAPID_PUBLIC_KEY ?? null} />
      <WeeklyScheduleView
        weekDates={weekDates}
        occurrences={occurrences}
        logs={logs}
      />
    </div>
  );
}
