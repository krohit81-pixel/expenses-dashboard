import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { withAuthTimingRetry } from "@/lib/supabase/retry";
import { OWNER_USER_ID } from "@/lib/owner";
import {
  logAhaanaActivityInputSchema,
  type LogAhaanaActivityInput,
} from "@/features/ahaana/schemas";

export type { LogAhaanaActivityInput };

/** One completed occurrence — what she covered, what to cover next (v3.4.0, the household's own example: "Monday 6:30-7:30 physics study session... marks this as complete and puts comments"). */
export interface AhaanaActivityLog {
  id: string;
  activityId: string;
  occurrenceDate: string;
  completedAt: string;
  coveredNotes: string | null;
  nextNotes: string | null;
}

const LOG_SELECT =
  "id, activity_id, occurrence_date, completed_at, covered_notes, next_notes";

function mapRow(row: {
  id: string;
  activity_id: string;
  occurrence_date: string;
  completed_at: string;
  covered_notes: string | null;
  next_notes: string | null;
}): AhaanaActivityLog {
  return {
    id: row.id,
    activityId: row.activity_id,
    occurrenceDate: row.occurrence_date,
    completedAt: row.completed_at,
    coveredNotes: row.covered_notes,
    nextNotes: row.next_notes,
  };
}

/**
 * Every log entry within a date range (inclusive) — used by the
 * weekly view (this week's range) and, later, the weekly report/intel
 * pass (a wider range).
 *
 * v3.4.9 — wrapped in withAuthTimingRetry, fixing a real reported bug:
 * "first time login gives error, next time it disappears" — exactly
 * Supabase's transient "JWT issued at future" clock-sync artifact on
 * the first query after idle traffic (her actual usage pattern: once
 * a day, long gaps between sessions), the same one CalendarEventService/
 * TripService/RecurringCalendarEventService already retry through this
 * helper. This was the query actually throwing in the reported error
 * log; listAhaanaActivities got the identical fix alongside it, since
 * it's the other read on the same page and just as exposed.
 */
export async function listAhaanaActivityLogs(
  rangeStart: string,
  rangeEnd: string,
): Promise<AhaanaActivityLog[]> {
  const supabase = createServiceClient();
  const { data, error } = await withAuthTimingRetry(() =>
    supabase
      .from("ahaana_activity_logs")
      .select(LOG_SELECT)
      .eq("user_id", OWNER_USER_ID)
      .gte("occurrence_date", rangeStart)
      .lte("occurrence_date", rangeEnd)
      .order("occurrence_date"),
  );

  if (error) {
    throw new Error(`Failed to load activity logs: ${error.message}`);
  }
  return data.map(mapRow);
}

/**
 * Marks one occurrence complete with notes — an upsert on
 * (activity_id, occurrence_date) so resubmitting the same occurrence's
 * form (e.g. to fix a typo in what was covered) edits the existing row
 * rather than creating a duplicate, matching the migration's own
 * unique constraint.
 */
export async function logAhaanaActivity(
  input: LogAhaanaActivityInput,
): Promise<AhaanaActivityLog> {
  const parsed = logAhaanaActivityInputSchema.parse(input);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("ahaana_activity_logs")
    .upsert(
      {
        user_id: OWNER_USER_ID,
        activity_id: parsed.activityId,
        occurrence_date: parsed.occurrenceDate,
        completed_at: new Date().toISOString(),
        covered_notes: parsed.coveredNotes ?? null,
        next_notes: parsed.nextNotes ?? null,
      },
      { onConflict: "activity_id,occurrence_date" },
    )
    .select(LOG_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to log activity completion: ${error.message}`);
  }
  return mapRow(data);
}
