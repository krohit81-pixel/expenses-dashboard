"use server";

import { revalidatePath } from "next/cache";

import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "@/services/CalendarEventService";
import {
  createCalendarEventInputSchema,
  updateCalendarEventInputSchema,
} from "@/features/calendar/schemas";

function formValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
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
    startDate: formValue(formData, "startDate"),
    endDate: formValue(formData, "endDate"),
    notes: formValue(formData, "notes") ?? null,
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
    startDate: formValue(formData, "startDate"),
    endDate: formValue(formData, "endDate"),
    notes: formValue(formData, "notes") ?? null,
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
