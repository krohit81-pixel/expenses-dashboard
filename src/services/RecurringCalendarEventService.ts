import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { OWNER_USER_ID } from "@/lib/owner";
import {
  createRecurringCalendarEventInputSchema,
  updateRecurringCalendarEventInputSchema,
  type CreateRecurringCalendarEventInput,
  type UpdateRecurringCalendarEventInput,
} from "@/features/calendar/recurring-schemas";

export type {
  CreateRecurringCalendarEventInput,
  UpdateRecurringCalendarEventInput,
};

/** A weekly-repeating rule, not a single occurrence — see the
 * finance.recurring_calendar_events migration comment. Occurrences are
 * computed from this via src/lib/dates/recurring-calendar-events.ts,
 * never stored per-date. */
export interface RecurringCalendarEvent {
  id: string;
  title: string;
  people: string[];
  mode: string | null;
  /** 0=Sunday..6=Saturday (JS Date#getUTCDay() convention), sorted ascending. */
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string;
  notes: string | null;
}

const RECURRING_CALENDAR_EVENT_SELECT =
  "id, title, people, mode, days_of_week, start_time, end_time, start_date, end_date, notes";

function mapRow(row: {
  id: string;
  title: string;
  people: string[];
  mode: string | null;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  start_date: string;
  end_date: string;
  notes: string | null;
}): RecurringCalendarEvent {
  return {
    id: row.id,
    title: row.title,
    people: row.people,
    mode: row.mode,
    // Postgres returns time as "HH:MM:SS" — trim to "HH:MM" to match
    // the <input type="time"> value shape used everywhere else this
    // travels (the modal, the schema's zTimeOfDay).
    daysOfWeek: row.days_of_week,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    startDate: row.start_date,
    endDate: row.end_date,
    notes: row.notes,
  };
}

/** All recurring calendar rules, soonest start first — same ordering convention as listCalendarEvents()/listTrips(). */
export async function listRecurringCalendarEvents(): Promise<
  RecurringCalendarEvent[]
> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("recurring_calendar_events")
    .select(RECURRING_CALENDAR_EVENT_SELECT)
    .eq("user_id", OWNER_USER_ID)
    .order("start_date");

  if (error) {
    throw new Error(
      `Failed to load recurring calendar events: ${error.message}`,
    );
  }

  return data.map(mapRow);
}

export async function createRecurringCalendarEvent(
  input: CreateRecurringCalendarEventInput,
): Promise<RecurringCalendarEvent> {
  const parsed = createRecurringCalendarEventInputSchema.parse(input);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("recurring_calendar_events")
    .insert({
      user_id: OWNER_USER_ID,
      title: parsed.title,
      people: parsed.people,
      mode: parsed.mode ?? null,
      days_of_week: parsed.daysOfWeek,
      start_time: parsed.startTime,
      end_time: parsed.endTime,
      start_date: parsed.startDate,
      end_date: parsed.endDate,
      notes: parsed.notes ?? null,
    })
    .select(RECURRING_CALENDAR_EVENT_SELECT)
    .single();

  if (error) {
    throw new Error(
      `Failed to create recurring calendar event: ${error.message}`,
    );
  }

  return mapRow(data);
}

export async function updateRecurringCalendarEvent(
  input: UpdateRecurringCalendarEventInput,
): Promise<RecurringCalendarEvent> {
  const parsed = updateRecurringCalendarEventInputSchema.parse(input);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("recurring_calendar_events")
    .update({
      title: parsed.title,
      people: parsed.people,
      mode: parsed.mode ?? null,
      days_of_week: parsed.daysOfWeek,
      start_time: parsed.startTime,
      end_time: parsed.endTime,
      start_date: parsed.startDate,
      end_date: parsed.endDate,
      notes: parsed.notes ?? null,
    })
    .eq("id", parsed.id)
    .eq("user_id", OWNER_USER_ID)
    .select(RECURRING_CALENDAR_EVENT_SELECT)
    .single();

  if (error) {
    throw new Error(
      `Failed to update recurring calendar event: ${error.message}`,
    );
  }

  return mapRow(data);
}

export async function deleteRecurringCalendarEvent(id: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("recurring_calendar_events")
    .delete()
    .eq("id", id)
    .eq("user_id", OWNER_USER_ID);

  if (error) {
    throw new Error(
      `Failed to delete recurring calendar event: ${error.message}`,
    );
  }
}
