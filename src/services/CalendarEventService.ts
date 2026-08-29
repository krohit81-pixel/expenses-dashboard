import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { withAuthTimingRetry } from "@/lib/supabase/retry";
import { OWNER_USER_ID } from "@/lib/owner";
import type { EventTag } from "@/features/calendar/data";
import {
  createCalendarEventInputSchema,
  updateCalendarEventInputSchema,
  type CreateCalendarEventInput,
  type UpdateCalendarEventInput,
} from "@/features/calendar/schemas";

export type { CreateCalendarEventInput, UpdateCalendarEventInput };

/** tag is narrowed to Exclude<EventTag, "trip"> at the schema level (zEventTag), but the column itself is a plain checked `text`, not a Postgres enum shared with the static school data — see the migration comment for why. */
export interface CalendarEvent {
  id: string;
  title: string;
  tag: Exclude<EventTag, "trip">;
  people: string[];
  startDate: string;
  endDate: string;
  /** v3.2.2 — optional time of day; null for an event with no specific time (see the migration comment). "HH:MM", trimmed from Postgres's "HH:MM:SS" the same way RecurringCalendarEventService's startTime already is. */
  startTime: string | null;
  notes: string | null;
  /** v3.2.0 — see supabase/migrations/20260822061100_create_notifications.sql. Whether ReminderService should notify about this event. */
  remindEnabled: boolean;
  /** Days before startDate to send the reminder (0 = the morning of). Only meaningful when remindEnabled is true AND remindLeadHours is null — the two are mutually exclusive, see detect-reminders.ts. */
  remindLeadDays: number;
  /** v3.2.2 — hours before startDate+startTime to send the reminder, instead of remindLeadDays. Null means "not using an hour-based reminder"; only meaningful when startTime is also set. */
  remindLeadHours: number | null;
}

const CALENDAR_EVENT_SELECT =
  "id, title, tag, people, start_date, end_date, start_time, notes, remind_enabled, remind_lead_days, remind_lead_hours";

function mapRow(row: {
  id: string;
  title: string;
  tag: string;
  people: string[];
  start_date: string;
  end_date: string;
  start_time: string | null;
  notes: string | null;
  remind_enabled: boolean;
  remind_lead_days: number;
  remind_lead_hours: number | null;
}): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    tag: row.tag as Exclude<EventTag, "trip">,
    people: row.people,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: row.start_time ? row.start_time.slice(0, 5) : null,
    notes: row.notes,
    remindEnabled: row.remind_enabled,
    remindLeadDays: row.remind_lead_days,
    remindLeadHours: row.remind_lead_hours,
  };
}

/** All manually-added calendar events, soonest first — same ordering convention as listTrips(). */
export async function listCalendarEvents(): Promise<CalendarEvent[]> {
  const supabase = createServiceClient();
  const { data, error } = await withAuthTimingRetry(() =>
    supabase
      .from("calendar_events")
      .select(CALENDAR_EVENT_SELECT)
      .eq("user_id", OWNER_USER_ID)
      .order("start_date"),
  );

  if (error) {
    throw new Error(`Failed to load calendar events: ${error.message}`);
  }

  return data.map(mapRow);
}

/** v3.4.13 — a single event by id, for the "Send reminder now" button (ReminderService.sendCalendarEventReminderNow), which needs one specific event rather than the whole list listCalendarEvents() already returns. Null, not a throw, when it's gone (deleted between the modal opening and the button being clicked) — the caller turns that into a plain error message, not a crash. */
export async function getCalendarEvent(
  id: string,
): Promise<CalendarEvent | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .select(CALENDAR_EVENT_SELECT)
    .eq("id", id)
    .eq("user_id", OWNER_USER_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load calendar event: ${error.message}`);
  }

  return data ? mapRow(data) : null;
}

export async function createCalendarEvent(
  input: CreateCalendarEventInput,
): Promise<CalendarEvent> {
  const parsed = createCalendarEventInputSchema.parse(input);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      user_id: OWNER_USER_ID,
      title: parsed.title,
      tag: parsed.tag,
      people: parsed.people,
      start_date: parsed.startDate,
      end_date: parsed.endDate,
      start_time: parsed.startTime,
      notes: parsed.notes ?? null,
      remind_enabled: parsed.remindEnabled,
      remind_lead_days: parsed.remindLeadDays,
      remind_lead_hours: parsed.remindLeadHours,
    })
    .select(CALENDAR_EVENT_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to create calendar event: ${error.message}`);
  }

  return mapRow(data);
}

export async function updateCalendarEvent(
  input: UpdateCalendarEventInput,
): Promise<CalendarEvent> {
  const parsed = updateCalendarEventInputSchema.parse(input);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("calendar_events")
    .update({
      title: parsed.title,
      tag: parsed.tag,
      people: parsed.people,
      start_date: parsed.startDate,
      end_date: parsed.endDate,
      start_time: parsed.startTime,
      notes: parsed.notes ?? null,
      remind_enabled: parsed.remindEnabled,
      remind_lead_days: parsed.remindLeadDays,
      remind_lead_hours: parsed.remindLeadHours,
    })
    .eq("id", parsed.id)
    .eq("user_id", OWNER_USER_ID)
    .select(CALENDAR_EVENT_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to update calendar event: ${error.message}`);
  }

  return mapRow(data);
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", id)
    .eq("user_id", OWNER_USER_ID);

  if (error) {
    throw new Error(`Failed to delete calendar event: ${error.message}`);
  }
}
