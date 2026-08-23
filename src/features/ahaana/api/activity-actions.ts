"use server";

import { revalidatePath } from "next/cache";

import {
  createAhaanaActivity,
  deleteAhaanaActivity,
  updateAhaanaActivity,
} from "@/services/AhaanaActivityService";
import { logAhaanaActivity } from "@/services/AhaanaActivityLogService";
import {
  createAhaanaActivityInputSchema,
  logAhaanaActivityInputSchema,
  updateAhaanaActivityInputSchema,
} from "@/features/ahaana/schemas";

function formValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** daysOfWeek is submitted as one FormData entry per selected day (same repeated-key convention as calendar's own actions.ts), each a string like "2" — the schema's zDaysOfWeek re-validates range/dedup/sort. */
function formDaysOfWeek(formData: FormData): number[] {
  return formData
    .getAll("daysOfWeek")
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .map(Number)
    .filter((n) => Number.isInteger(n));
}

export interface AhaanaActivityFormState {
  error?: string;
  success?: boolean;
}

export async function createAhaanaActivityAction(
  _prevState: AhaanaActivityFormState,
  formData: FormData,
): Promise<AhaanaActivityFormState> {
  const parsed = createAhaanaActivityInputSchema.safeParse({
    title: formValue(formData, "title"),
    category: formValue(formData, "category"),
    daysOfWeek: formDaysOfWeek(formData),
    startTime: formValue(formData, "startTime"),
    endTime: formValue(formData, "endTime"),
    startDate: formValue(formData, "startDate"),
    endDate: formValue(formData, "endDate"),
    planNotes: formValue(formData, "planNotes") ?? null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await createAhaanaActivity(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/ahaana");
  revalidatePath("/ahaana/manage");
  return { success: true };
}

export async function updateAhaanaActivityAction(
  _prevState: AhaanaActivityFormState,
  formData: FormData,
): Promise<AhaanaActivityFormState> {
  const parsed = updateAhaanaActivityInputSchema.safeParse({
    id: formValue(formData, "id"),
    title: formValue(formData, "title"),
    category: formValue(formData, "category"),
    daysOfWeek: formDaysOfWeek(formData),
    startTime: formValue(formData, "startTime"),
    endTime: formValue(formData, "endTime"),
    startDate: formValue(formData, "startDate"),
    endDate: formValue(formData, "endDate"),
    planNotes: formValue(formData, "planNotes") ?? null,
    active: formValue(formData, "active"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await updateAhaanaActivity(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/ahaana");
  revalidatePath("/ahaana/manage");
  return { success: true };
}

export async function deleteAhaanaActivityAction(
  _prevState: AhaanaActivityFormState,
  formData: FormData,
): Promise<AhaanaActivityFormState> {
  const id = formValue(formData, "id");
  if (!id) {
    return { error: "Missing activity id" };
  }

  try {
    await deleteAhaanaActivity(id);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/ahaana");
  revalidatePath("/ahaana/manage");
  return { success: true };
}

export interface LogAhaanaActivityFormState {
  error?: string;
  success?: boolean;
}

export async function logAhaanaActivityAction(
  _prevState: LogAhaanaActivityFormState,
  formData: FormData,
): Promise<LogAhaanaActivityFormState> {
  const parsed = logAhaanaActivityInputSchema.safeParse({
    activityId: formValue(formData, "activityId"),
    occurrenceDate: formValue(formData, "occurrenceDate"),
    coveredNotes: formValue(formData, "coveredNotes") ?? null,
    nextNotes: formValue(formData, "nextNotes") ?? null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await logAhaanaActivity(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/ahaana");
  return { success: true };
}
