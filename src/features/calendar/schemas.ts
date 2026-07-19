import { z } from "zod";

/**
 * Manually-added calendar events (v1.1.5) — free text, tagged with one
 * of the same four categories the static school calendar uses. "trip"
 * is deliberately not offered here; that's finance.trips's job, not
 * this table's (see the migration comment).
 */
const zEventTag = z.enum(["vacation", "holiday", "exam", "event"]);

const baseCalendarEventFields = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  tag: zEventTag,
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

function refineDateOrder<T extends { startDate: string; endDate: string }>(
  value: T,
  ctx: z.RefinementCtx,
) {
  if (value.endDate < value.startDate) {
    ctx.addIssue({
      code: "custom",
      message: "End date cannot be before the start date",
      path: ["endDate"],
    });
  }
}

export const createCalendarEventInputSchema =
  baseCalendarEventFields.superRefine(refineDateOrder);
export type CreateCalendarEventInput = z.infer<
  typeof createCalendarEventInputSchema
>;

export const updateCalendarEventInputSchema = baseCalendarEventFields
  .extend({ id: z.uuid() })
  .superRefine(refineDateOrder);
export type UpdateCalendarEventInput = z.infer<
  typeof updateCalendarEventInputSchema
>;
