import { z } from "zod";

import { zTimeOfDay } from "@/features/calendar/schemas";

/**
 * Validation for finance.ahaana_activities / ahaana_activity_logs
 * (v3.4.0). zTimeOfDay is reused from features/calendar/schemas.ts —
 * same "HH:MM" 24-hour shape every time-of-day field in this app
 * already validates against, no reason for a second copy.
 */

const zAhaanaCategory = z.enum(["class", "sport", "study", "other"]);

const zDaysOfWeek = z
  .array(z.number().int().min(0).max(6))
  .min(1, "Pick at least one day of the week")
  .transform((days) => Array.from(new Set(days)).sort((a, b) => a - b));

const baseActivityFields = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  category: zAhaanaCategory,
  daysOfWeek: zDaysOfWeek,
  startTime: zTimeOfDay,
  endTime: zTimeOfDay,
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  planNotes: z.string().trim().max(1000).nullable().optional(),
});

function refineOrder<
  T extends {
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
  },
>(value: T, ctx: z.RefinementCtx) {
  if (value.endDate < value.startDate) {
    ctx.addIssue({
      code: "custom",
      message: "End date cannot be before the start date",
      path: ["endDate"],
    });
  }
  if (value.endTime <= value.startTime) {
    ctx.addIssue({
      code: "custom",
      message: "End time must be after the start time",
      path: ["endTime"],
    });
  }
}

export const createAhaanaActivityInputSchema =
  baseActivityFields.superRefine(refineOrder);
export type CreateAhaanaActivityInput = z.infer<
  typeof createAhaanaActivityInputSchema
>;

export const updateAhaanaActivityInputSchema = baseActivityFields
  .extend({ id: z.uuid(), active: z.coerce.boolean().default(true) })
  .superRefine(refineOrder);
export type UpdateAhaanaActivityInput = z.infer<
  typeof updateAhaanaActivityInputSchema
>;

export const logAhaanaActivityInputSchema = z.object({
  activityId: z.uuid(),
  occurrenceDate: z.iso.date(),
  coveredNotes: z.string().trim().max(2000).nullable().optional(),
  nextNotes: z.string().trim().max(2000).nullable().optional(),
});
export type LogAhaanaActivityInput = z.infer<
  typeof logAhaanaActivityInputSchema
>;
