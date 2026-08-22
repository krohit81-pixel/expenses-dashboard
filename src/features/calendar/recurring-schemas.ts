import { z } from "zod";

import {
  zReminderFields,
  zHourlyReminderFields,
  zTimeOfDay,
} from "@/features/calendar/schemas";

/**
 * Validation for finance.recurring_calendar_events (v2.2.0) — a
 * weekly-repeating rule, not a single date. See that migration's comment
 * for the shape rationale (general-purpose, not class-schedule-specific;
 * bounded start/end date, no "repeats forever" option).
 */

/** Same free-text, dedup'd, optional-array convention as
 * features/calendar/schemas.ts's zEventPeople — a rule doesn't have to
 * be tagged to anyone to be worth saving. */
const zRecurringPeople = z
  .array(z.string().trim().min(1).max(60))
  .default([])
  .transform((names) => Array.from(new Set(names)));

/** 0=Sunday..6=Saturday, matching JS Date#getUTCDay() — see the
 * migration's column comment. At least one day required; duplicates
 * collapsed and sorted so "Tue, Fri" always renders the same way
 * regardless of click order in the day picker. */
const zDaysOfWeek = z
  .array(z.number().int().min(0).max(6))
  .min(1, "Pick at least one day of the week")
  .transform((days) => Array.from(new Set(days)).sort((a, b) => a - b));

const baseRecurringEventFields = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  people: zRecurringPeople,
  mode: z
    .string()
    .trim()
    .max(40)
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  daysOfWeek: zDaysOfWeek,
  startTime: zTimeOfDay,
  endTime: zTimeOfDay,
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  notes: z.string().trim().max(1000).nullable().optional(),
  ...zReminderFields.shape,
  // v3.2.2 — every rule already has a real startTime, so no
  // "requires a time" refinement is needed here the way calendar
  // events' optional startTime needs one (see schemas.ts).
  ...zHourlyReminderFields.shape,
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

export const createRecurringCalendarEventInputSchema =
  baseRecurringEventFields.superRefine(refineOrder);
export type CreateRecurringCalendarEventInput = z.infer<
  typeof createRecurringCalendarEventInputSchema
>;

export const updateRecurringCalendarEventInputSchema = baseRecurringEventFields
  .extend({ id: z.uuid() })
  .superRefine(refineOrder);
export type UpdateRecurringCalendarEventInput = z.infer<
  typeof updateRecurringCalendarEventInputSchema
>;
