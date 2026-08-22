import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { OWNER_USER_ID } from "@/lib/owner";
import type { ChannelType } from "@/lib/notifications/provider";

export type NotificationEventType =
  | "calendar_event"
  | "trip"
  | "recurring_calendar_event"
  // v3.2.1 — the static Ahaana/Rohana school calendars
  // (src/features/calendar/data.ts), not a finance.calendar_events row
  // (see detectSchoolCalendarReminders' comment for why this is a
  // separate type rather than reusing "calendar_event").
  | "school_calendar_event";

export interface NotificationLogKey {
  eventType: NotificationEventType;
  eventKey: string;
  leadTimeDays: number;
  /** v3.2.2 — disambiguates leadTimeDays ("days" or "hours"); part of the dedupe identity alongside it. See notification_log_sent_dedupe_idx. */
  leadTimeUnit: "days" | "hours";
  channelType: ChannelType;
}

/**
 * The dedupe/audit trail behind ReminderService — v3.2.0. Same
 * lookup-then-skip idiom RecurringTransactionService.applyCycleTags
 * already uses for cycle tagging (look up what's already there, act
 * only on what's missing), applied to notification sends instead of
 * transaction tags.
 *
 * `leadTimeDays` is part of the identity on purpose: a "3 days before"
 * and a "on the day" reminder for the exact same event are two
 * distinct, both-legitimate sends, not duplicates of each other.
 */
export async function alreadySent(key: NotificationLogKey): Promise<boolean> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("notification_log")
    .select("id")
    .eq("user_id", OWNER_USER_ID)
    .eq("event_type", key.eventType)
    .eq("event_key", key.eventKey)
    .eq("lead_time_days", key.leadTimeDays)
    .eq("lead_time_unit", key.leadTimeUnit)
    .eq("channel_type", key.channelType)
    .eq("status", "sent")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check notification log: ${error.message}`);
  }
  return data !== null;
}

/**
 * Every key already sent for the given event type, as a Set of
 * "eventKey:leadTimeDays:channelType" strings — lets ReminderService
 * check a whole batch of candidates against one query instead of one
 * round trip per candidate event, same reasoning as
 * RecurringTransactionService.listCycleTagsForMonth existing at all
 * rather than calling a per-template lookup in a loop.
 */
export async function listSentKeys(
  eventType: NotificationEventType,
): Promise<Set<string>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("notification_log")
    .select("event_key, lead_time_days, lead_time_unit, channel_type")
    .eq("user_id", OWNER_USER_ID)
    .eq("event_type", eventType)
    .eq("status", "sent");

  if (error) {
    throw new Error(`Failed to list sent notifications: ${error.message}`);
  }

  return new Set(
    data.map(
      (row) =>
        `${row.event_key}:${row.lead_time_days}:${row.lead_time_unit}:${row.channel_type}`,
    ),
  );
}

export function logKeyString(key: NotificationLogKey): string {
  return `${key.eventKey}:${key.leadTimeDays}:${key.leadTimeUnit}:${key.channelType}`;
}

export async function recordSent(
  key: NotificationLogKey,
  providerMessageId: string | undefined,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("notification_log").insert({
    user_id: OWNER_USER_ID,
    event_type: key.eventType,
    event_key: key.eventKey,
    lead_time_days: key.leadTimeDays,
    lead_time_unit: key.leadTimeUnit,
    channel_type: key.channelType,
    status: "sent",
    provider_message_id: providerMessageId ?? null,
    sent_at: new Date().toISOString(),
  });

  // A unique-constraint violation here means something else already
  // logged this exact send (e.g. two overlapping manual "Run reminders
  // now" clicks) — treated as success, not an error, since the
  // constraint is doing exactly its dedupe job, not reporting a real
  // failure.
  if (error && error.code !== "23505") {
    throw new Error(`Failed to record sent notification: ${error.message}`);
  }
}

export async function recordFailed(
  key: NotificationLogKey,
  errorMessage: string,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("notification_log").insert({
    user_id: OWNER_USER_ID,
    event_type: key.eventType,
    event_key: key.eventKey,
    lead_time_days: key.leadTimeDays,
    lead_time_unit: key.leadTimeUnit,
    channel_type: key.channelType,
    status: "failed",
    error: errorMessage.slice(0, 500),
  });

  if (error && error.code !== "23505") {
    throw new Error(`Failed to record failed notification: ${error.message}`);
  }
}
