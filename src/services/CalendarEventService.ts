import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
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
  startDate: string;
  endDate: string;
  notes: string | null;
}

const CALENDAR_EVENT_SELECT = "id, title, tag, start_date, end_date, notes";

function mapRow(row: {
  id: string;
  title: string;
  tag: string;
  start_date: string;
  end_date: string;
  notes: string | null;
}): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    tag: row.tag as Exclude<EventTag, "trip">,
    startDate: row.start_date,
    endDate: row.end_date,
    notes: row.notes,
  };
}

/** All manually-added calendar events, soonest first — same ordering convention as listTrips(). */
export async function listCalendarEvents(): Promise<CalendarEvent[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("calendar_events")
    .select(CALENDAR_EVENT_SELECT)
    .eq("user_id", OWNER_USER_ID)
    .order("start_date");

  if (error) {
    throw new Error(`Failed to load calendar events: ${error.message}`);
  }

  return data.map(mapRow);
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
      start_date: parsed.startDate,
      end_date: parsed.endDate,
      notes: parsed.notes ?? null,
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
      start_date: parsed.startDate,
      end_date: parsed.endDate,
      notes: parsed.notes ?? null,
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
