import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { withAuthTimingRetry } from "@/lib/supabase/retry";
import { OWNER_USER_ID } from "@/lib/owner";
import {
  createAhaanaActivityInputSchema,
  updateAhaanaActivityInputSchema,
  type CreateAhaanaActivityInput,
  type UpdateAhaanaActivityInput,
} from "@/features/ahaana/schemas";

export type { CreateAhaanaActivityInput, UpdateAhaanaActivityInput };

export type AhaanaActivityCategory = "class" | "sport" | "study" | "other";

/**
 * A weekly-recurring rule for Ahaana's mini app (v3.4.0) — the same
 * shape as finance.recurring_calendar_events, kept as its own table
 * rather than reused: that one feeds the shared family /calendar page
 * (visibility filters, person tagging), this one is exclusively her
 * own mini app and never shown there. See the migration's own comment.
 */
export interface AhaanaActivity {
  id: string;
  title: string;
  category: AhaanaActivityCategory;
  /** 0=Sunday..6=Saturday (JS Date#getUTCDay() convention), sorted ascending — same as recurring_calendar_events.days_of_week. */
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string;
  planNotes: string | null;
  active: boolean;
  /** v3.4.0 Phase 2 — whether ReminderService should push-notify before each occurrence. */
  remindEnabled: boolean;
  /** Days before each occurrence's date to send the reminder (0 = the morning of). */
  remindLeadDays: number;
  /** v3.4.3 — hours before each occurrence's own date+startTime, as an alternative to remindLeadDays. Null means "use remindLeadDays instead"; the two are mutually exclusive in practice, same convention as calendar_events/recurring_calendar_events. */
  remindLeadHours: number | null;
}

const AHAANA_ACTIVITY_SELECT =
  "id, title, category, days_of_week, start_time, end_time, start_date, end_date, plan_notes, active, remind_enabled, remind_lead_days, remind_lead_hours";

function mapRow(row: {
  id: string;
  title: string;
  category: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  start_date: string;
  end_date: string;
  plan_notes: string | null;
  active: boolean;
  remind_enabled: boolean;
  remind_lead_days: number;
  remind_lead_hours: number | null;
}): AhaanaActivity {
  return {
    id: row.id,
    title: row.title,
    category: row.category as AhaanaActivityCategory,
    daysOfWeek: row.days_of_week,
    // Postgres returns time as "HH:MM:SS" — trim to "HH:MM", same
    // convention as RecurringCalendarEventService.
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    startDate: row.start_date,
    endDate: row.end_date,
    planNotes: row.plan_notes,
    active: row.active,
    remindEnabled: row.remind_enabled,
    remindLeadDays: row.remind_lead_days,
    remindLeadHours: row.remind_lead_hours,
  };
}

/**
 * Every activity, active or not, soonest start first — the manage
 * page needs to show inactive ones too (to reactivate), the weekly
 * view filters to active itself.
 *
 * v3.4.9 — wrapped in withAuthTimingRetry: her own real-world usage
 * pattern (once a day, long idle gaps between sessions) is exactly
 * the "first request after idle" case that transient error hits, and
 * this was the one read query on her page that had been missed —
 * every other list*() in this app already goes through this same
 * helper (TripService, CalendarEventService,
 * RecurringCalendarEventService).
 */
export async function listAhaanaActivities(): Promise<AhaanaActivity[]> {
  const supabase = createServiceClient();
  const { data, error } = await withAuthTimingRetry(() =>
    supabase
      .from("ahaana_activities")
      .select(AHAANA_ACTIVITY_SELECT)
      .eq("user_id", OWNER_USER_ID)
      .order("start_date"),
  );

  if (error) {
    throw new Error(`Failed to load Ahaana's activities: ${error.message}`);
  }
  return data.map(mapRow);
}

export async function createAhaanaActivity(
  input: CreateAhaanaActivityInput,
): Promise<AhaanaActivity> {
  const parsed = createAhaanaActivityInputSchema.parse(input);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("ahaana_activities")
    .insert({
      user_id: OWNER_USER_ID,
      title: parsed.title,
      category: parsed.category,
      days_of_week: parsed.daysOfWeek,
      start_time: parsed.startTime,
      end_time: parsed.endTime,
      start_date: parsed.startDate,
      end_date: parsed.endDate,
      plan_notes: parsed.planNotes ?? null,
      active: true,
      remind_enabled: parsed.remindEnabled,
      remind_lead_days: parsed.remindLeadDays,
      remind_lead_hours: parsed.remindLeadHours,
    })
    .select(AHAANA_ACTIVITY_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to create activity: ${error.message}`);
  }
  return mapRow(data);
}

export async function updateAhaanaActivity(
  input: UpdateAhaanaActivityInput,
): Promise<AhaanaActivity> {
  const parsed = updateAhaanaActivityInputSchema.parse(input);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("ahaana_activities")
    .update({
      title: parsed.title,
      category: parsed.category,
      days_of_week: parsed.daysOfWeek,
      start_time: parsed.startTime,
      end_time: parsed.endTime,
      start_date: parsed.startDate,
      end_date: parsed.endDate,
      plan_notes: parsed.planNotes ?? null,
      active: parsed.active,
      remind_enabled: parsed.remindEnabled,
      remind_lead_days: parsed.remindLeadDays,
      remind_lead_hours: parsed.remindLeadHours,
    })
    .eq("id", parsed.id)
    .eq("user_id", OWNER_USER_ID)
    .select(AHAANA_ACTIVITY_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to update activity: ${error.message}`);
  }
  return mapRow(data);
}

export async function deleteAhaanaActivity(id: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("ahaana_activities")
    .delete()
    .eq("id", id)
    .eq("user_id", OWNER_USER_ID);

  if (error) {
    throw new Error(`Failed to delete activity: ${error.message}`);
  }
}
