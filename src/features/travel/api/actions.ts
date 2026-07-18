"use server";

import { revalidatePath } from "next/cache";

import { createTrip, deleteTrip, updateTrip } from "@/services/TripService";
import {
  createTripInputSchema,
  updateTripInputSchema,
} from "@/features/travel/schemas";

function formValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** travelerNames is submitted as one FormData entry per name (same key, repeated) — see AddTripModal, which appends one entry per selected/typed traveller rather than joining them into a single delimited string. */
function travelerNames(formData: FormData): string[] {
  return formData
    .getAll("travelerNames")
    .filter((v): v is string => typeof v === "string" && v.length > 0);
}

export interface TripFormState {
  error?: string;
  success?: boolean;
}

export async function createTripAction(
  _prevState: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const parsed = createTripInputSchema.safeParse({
    destination: formValue(formData, "destination"),
    startDate: formValue(formData, "startDate"),
    endDate: formValue(formData, "endDate"),
    flight: formValue(formData, "flight") ?? null,
    travelerNames: travelerNames(formData),
    notes: formValue(formData, "notes") ?? null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await createTrip(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/calendar");
  return { success: true };
}

export async function updateTripAction(
  _prevState: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const parsed = updateTripInputSchema.safeParse({
    id: formValue(formData, "id"),
    destination: formValue(formData, "destination"),
    startDate: formValue(formData, "startDate"),
    endDate: formValue(formData, "endDate"),
    flight: formValue(formData, "flight") ?? null,
    travelerNames: travelerNames(formData),
    notes: formValue(formData, "notes") ?? null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await updateTrip(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/calendar");
  return { success: true };
}

export async function deleteTripAction(
  _prevState: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const id = formValue(formData, "id");

  if (!id) {
    return { error: "Missing trip id" };
  }

  try {
    await deleteTrip(id);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/calendar");
  return { success: true };
}
