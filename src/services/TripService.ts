import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { withAuthTimingRetry } from "@/lib/supabase/retry";
import { OWNER_USER_ID } from "@/lib/owner";
import {
  createTripInputSchema,
  updateTripInputSchema,
  type CreateTripInput,
  type UpdateTripInput,
} from "@/features/travel/schemas";

export type { CreateTripInput, UpdateTripInput };

export interface Trip {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  flight: string | null;
  travelerNames: string[];
  notes: string | null;
  /** v3.2.0 — see supabase/migrations/20260822061100_create_notifications.sql. Whether ReminderService should notify about this trip. */
  remindEnabled: boolean;
  /** Days before startDate (departure) to send the reminder (0 = the morning of). Only meaningful when remindEnabled is true. */
  remindLeadDays: number;
}

const TRIP_SELECT =
  "id, destination, start_date, end_date, flight, traveler_names, notes, remind_enabled, remind_lead_days";

function mapRow(row: {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  flight: string | null;
  traveler_names: string[];
  notes: string | null;
  remind_enabled: boolean;
  remind_lead_days: number;
}): Trip {
  return {
    id: row.id,
    destination: row.destination,
    startDate: row.start_date,
    endDate: row.end_date,
    flight: row.flight,
    travelerNames: row.traveler_names,
    notes: row.notes,
    remindEnabled: row.remind_enabled,
    remindLeadDays: row.remind_lead_days,
  };
}

/** All trips, soonest departure first — same ordering the calendar's merged detailed list and month grid both want. */
export async function listTrips(): Promise<Trip[]> {
  const supabase = createServiceClient();
  const { data, error } = await withAuthTimingRetry(() =>
    supabase
      .from("trips")
      .select(TRIP_SELECT)
      .eq("user_id", OWNER_USER_ID)
      .order("start_date"),
  );

  if (error) {
    throw new Error(`Failed to load trips: ${error.message}`);
  }

  return data.map(mapRow);
}

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const parsed = createTripInputSchema.parse(input);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("trips")
    .insert({
      user_id: OWNER_USER_ID,
      destination: parsed.destination,
      start_date: parsed.startDate,
      end_date: parsed.endDate,
      flight: parsed.flight ?? null,
      traveler_names: parsed.travelerNames,
      notes: parsed.notes ?? null,
      remind_enabled: parsed.remindEnabled,
      remind_lead_days: parsed.remindLeadDays,
    })
    .select(TRIP_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to create trip: ${error.message}`);
  }

  return mapRow(data);
}

export async function updateTrip(input: UpdateTripInput): Promise<Trip> {
  const parsed = updateTripInputSchema.parse(input);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("trips")
    .update({
      destination: parsed.destination,
      start_date: parsed.startDate,
      end_date: parsed.endDate,
      flight: parsed.flight ?? null,
      traveler_names: parsed.travelerNames,
      notes: parsed.notes ?? null,
      remind_enabled: parsed.remindEnabled,
      remind_lead_days: parsed.remindLeadDays,
    })
    .eq("id", parsed.id)
    .eq("user_id", OWNER_USER_ID)
    .select(TRIP_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to update trip: ${error.message}`);
  }

  return mapRow(data);
}

export async function deleteTrip(id: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("trips")
    .delete()
    .eq("id", id)
    .eq("user_id", OWNER_USER_ID);

  if (error) {
    throw new Error(`Failed to delete trip: ${error.message}`);
  }
}
