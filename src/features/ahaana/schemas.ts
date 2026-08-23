import { z } from "zod";

import {
  zTimeOfDay,
  zReminderFields,
  zHourlyReminderFields,
} from "@/features/calendar/schemas";

/**
 * Validation for finance.ahaana_activities / ahaana_activity_logs
 * (v3.4.0). zTimeOfDay/zReminderFields are reused from
 * features/calendar/schemas.ts — same "HH:MM" 24-hour shape and same
 * remindEnabled/remindLeadDays pair every reminder-capable table in
 * this app already validates against, no reason for a second copy.
 *
 * v3.4.3 — zHourlyReminderFields (remindLeadHours) is reused too. No
 * "needs a start time first" refinement here unlike calendar_events':
 * every ahaana_activities row already has a required startTime (unlike
 * a plain calendar event's optional one), so hours mode is always
 * valid from day one, nothing to guard against.
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
  // v3.4.10 — a plain checkbox field (unchecked = omitted from
  // FormData entirely, checked = "true"), same convention
  // remindEnabled already uses — safe with z.coerce.boolean() here
  // unlike `active` below, since this field is never asked to
  // represent an explicit "false" string the way that toggle is.
  alternateWeeks: z.coerce.boolean().default(false),
  ...zReminderFields.shape,
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

export const createAhaanaActivityInputSchema =
  baseActivityFields.superRefine(refineOrder);
export type CreateAhaanaActivityInput = z.infer<
  typeof createAhaanaActivityInputSchema
>;

export const updateAhaanaActivityInputSchema = baseActivityFields
  .extend({
    id: z.uuid(),
    // v3.4.8 — plain z.boolean(), not z.coerce.boolean(): coerce runs
    // JS's own Boolean(value), which treats ANY non-empty string as
    // true — including the literal string "false". That made the
    // Deactivate button a no-op from day one (its hidden field's
    // "false" string silently coerced back to true) — a real,
    // previously-undiscovered bug, not a hypothetical one. The route
    // in from a raw form value now does the string comparison itself
    // (`formValue(...) === "true"`, in activity-actions.ts), same
    // convention already used for this exact shape in
    // features/merchants/categories' own active-toggle actions — so
    // this schema only ever receives a real boolean already.
    active: z.boolean().default(true),
  })
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
