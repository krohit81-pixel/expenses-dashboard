"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "@/services/CalendarEventService";
import {
  createRecurringCalendarEvent,
  deleteRecurringCalendarEvent,
  updateRecurringCalendarEvent,
} from "@/services/RecurringCalendarEventService";
import { sendCalendarEventReminderNow } from "@/services/ReminderService";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/access-gate";
import {
  createCalendarEventInputSchema,
  updateCalendarEventInputSchema,
} from "@/features/calendar/schemas";
import {
  createRecurringCalendarEventInputSchema,
  updateRecurringCalendarEventInputSchema,
} from "@/features/calendar/recurring-schemas";

function formValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** people is submitted as one FormData entry per name (same key, repeated) — same convention as travelerNames in the travel feature's actions.ts, see AddEventModal. */
function eventPeople(formData: FormData): string[] {
  return formData
    .getAll("people")
    .filter((v): v is string => typeof v === "string" && v.length > 0);
}

/** daysOfWeek is submitted as one FormData entry per selected day (same repeated-key convention as people), each a string like "2" — the schema's zDaysOfWeek re-validates range/dedup/sort, this just gets them into number form. */
function eventDaysOfWeek(formData: FormData): number[] {
  return formData
    .getAll("daysOfWeek")
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .map(Number)
    .filter((n) => Number.isInteger(n));
}

export interface CalendarEventFormState {
  error?: string;
  success?: boolean;
}

export async function createCalendarEventAction(
  _prevState: CalendarEventFormState,
  formData: FormData,
): Promise<CalendarEventFormState> {
  const parsed = createCalendarEventInputSchema.safeParse({
    title: formValue(formData, "title"),
    tag: formValue(formData, "tag"),
    people: eventPeople(formData),
    startDate: formValue(formData, "startDate"),
    endDate: formValue(formData, "endDate"),
    startTime: formValue(formData, "startTime") ?? null,
    endTime: formValue(formData, "endTime") ?? null,
    notes: formValue(formData, "notes") ?? null,
    remindEnabled: formValue(formData, "remindEnabled"),
    remindLeadDays: formValue(formData, "remindLeadDays"),
    remindLeadHours: formValue(formData, "remindLeadHours") ?? null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await createCalendarEvent(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/calendar");
  return { success: true };
}

export async function updateCalendarEventAction(
  _prevState: CalendarEventFormState,
  formData: FormData,
): Promise<CalendarEventFormState> {
  const parsed = updateCalendarEventInputSchema.safeParse({
    id: formValue(formData, "id"),
    title: formValue(formData, "title"),
    tag: formValue(formData, "tag"),
    people: eventPeople(formData),
    startDate: formValue(formData, "startDate"),
    endDate: formValue(formData, "endDate"),
    startTime: formValue(formData, "startTime") ?? null,
    endTime: formValue(formData, "endTime") ?? null,
    notes: formValue(formData, "notes") ?? null,
    remindEnabled: formValue(formData, "remindEnabled"),
    remindLeadDays: formValue(formData, "remindLeadDays"),
    remindLeadHours: formValue(formData, "remindLeadHours") ?? null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await updateCalendarEvent(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/calendar");
  return { success: true };
}

export async function deleteCalendarEventAction(
  _prevState: CalendarEventFormState,
  formData: FormData,
): Promise<CalendarEventFormState> {
  const id = formValue(formData, "id");

  if (!id) {
    return { error: "Missing event id" };
  }

  try {
    await deleteCalendarEvent(id);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/calendar");
  return { success: true };
}

export interface SendReminderNowFormState {
  error?: string;
  message?: string;
}

/**
 * v3.4.13 — the manual "Send reminder now" button in the event edit
 * modal. /calendar is the one PUBLIC page in this app (see
 * middleware.ts's PUBLIC_PATHS) — every other action above only ever
 * touches calendar data itself, but this one pushes a real message to
 * the household's own Telegram, a meaningfully bigger action. The
 * button is disabled client-side unless logged in, but a disabled
 * attribute is a UI nicety, not a security boundary (trivially
 * bypassed with a direct call to this action) — so this re-checks the
 * main app_access cookie itself before doing anything.
 */
export async function sendCalendarEventReminderNowAction(
  _prevState: SendReminderNowFormState,
  formData: FormData,
): Promise<SendReminderNowFormState> {
  const cookieStore = await cookies();
  if (!verifyAccessToken(cookieStore.get(ACCESS_COOKIE_NAME)?.value)) {
    return { error: "Log in to the main app first, then try again." };
  }

  const id = formValue(formData, "id");
  if (!id) {
    return { error: "Missing event id" };
  }

  const result = await sendCalendarEventReminderNow(id);
  if (!result.ok) {
    return { error: result.error };
  }

  return { message: "Sent — check Telegram." };
}

export interface RecurringCalendarEventFormState {
  error?: string;
  success?: boolean;
}

export async function createRecurringCalendarEventAction(
  _prevState: RecurringCalendarEventFormState,
  formData: FormData,
): Promise<RecurringCalendarEventFormState> {
  const parsed = createRecurringCalendarEventInputSchema.safeParse({
    title: formValue(formData, "title"),
    people: eventPeople(formData),
    mode: formValue(formData, "mode") ?? null,
    daysOfWeek: eventDaysOfWeek(formData),
    startTime: formValue(formData, "startTime"),
    endTime: formValue(formData, "endTime"),
    startDate: formValue(formData, "startDate"),
    endDate: formValue(formData, "endDate"),
    notes: formValue(formData, "notes") ?? null,
    remindEnabled: formValue(formData, "remindEnabled"),
    remindLeadDays: formValue(formData, "remindLeadDays"),
    remindLeadHours: formValue(formData, "remindLeadHours") ?? null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await createRecurringCalendarEvent(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/calendar");
  return { success: true };
}

export async function updateRecurringCalendarEventAction(
  _prevState: RecurringCalendarEventFormState,
  formData: FormData,
): Promise<RecurringCalendarEventFormState> {
  const parsed = updateRecurringCalendarEventInputSchema.safeParse({
    id: formValue(formData, "id"),
    title: formValue(formData, "title"),
    people: eventPeople(formData),
    mode: formValue(formData, "mode") ?? null,
    daysOfWeek: eventDaysOfWeek(formData),
    startTime: formValue(formData, "startTime"),
    endTime: formValue(formData, "endTime"),
    startDate: formValue(formData, "startDate"),
    endDate: formValue(formData, "endDate"),
    notes: formValue(formData, "notes") ?? null,
    remindEnabled: formValue(formData, "remindEnabled"),
    remindLeadDays: formValue(formData, "remindLeadDays"),
    remindLeadHours: formValue(formData, "remindLeadHours") ?? null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await updateRecurringCalendarEvent(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/calendar");
  return { success: true };
}

export async function deleteRecurringCalendarEventAction(
  _prevState: RecurringCalendarEventFormState,
  formData: FormData,
): Promise<RecurringCalendarEventFormState> {
  const id = formValue(formData, "id");

  if (!id) {
    return { error: "Missing recurring event id" };
  }

  try {
    await deleteRecurringCalendarEvent(id);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/calendar");
  return { success: true };
}
