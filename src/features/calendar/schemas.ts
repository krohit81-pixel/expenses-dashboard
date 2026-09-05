import { z } from "zod";

/**
 * Manually-added calendar events (v1.1.5) — free text, tagged with one
 * of the same four categories the static school calendar uses. "trip"
 * is deliberately not offered here; that's finance.trips's job, not
 * this table's (see the migration comment).
 */
const zEventTag = z.enum(["vacation", "holiday", "exam", "event"]);

/**
 * Who this event is tagged for (v1.1.6) — same free-text convention as
 * finance.trips.traveler_names (see AddTripModal), just optional here:
 * a dinner reminder doesn't have to be tagged to anyone to be useful,
 * unlike a trip, which always needs at least one traveller to be worth
 * showing at all. Empty array (the default) means untagged.
 */
const zEventPeople = z
  .array(z.string().trim().min(1).max(60))
  .default([])
  .transform((names) => Array.from(new Set(names)));

/**
 * v3.2.0 — the reminder toggle + lead time shared by calendar events,
 * trips, and recurring calendar event rules (identical field shape on
 * all three, see zReminderFields reused in features/travel/schemas.ts
 * and features/calendar/recurring-schemas.ts). remindLeadDays isn't
 * restricted to the UI's 0/1/3 options here — same "don't over-constrain
 * a column for a UI-level choice" reasoning as the DB column itself
 * (see the migration comment); a future UI offering more choices needs
 * no schema change on either side.
 */
export const zReminderFields = z.object({
  remindEnabled: z.coerce.boolean().default(false),
  remindLeadDays: z.coerce.number().int().min(0).max(365).default(0),
});

/** "08:00" — a 24-hour HH:MM time, shared by calendar events' optional startTime and recurring rules' required startTime/endTime. Was private to recurring-schemas.ts until v3.2.2 gave calendar events a time field too; lives here now as the one shared definition. */
export const zTimeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour HH:MM time");

/**
 * v3.2.2 — an alternative, more granular lead time for rows that carry
 * a real time of day (calendar events with an optional startTime set,
 * and recurring calendar event rules, which always have one). NOT part
 * of zReminderFields itself: finance.trips has no time column and
 * never offers this option (household explicitly asked for day-before
 * only on trips), so folding it into the shape every one of the three
 * reminder-capable tables shares would give trips a meaningless field.
 * remindLeadHours null means "not using an hour-based reminder for
 * this row" — remindLeadDays governs instead, exactly like before this
 * existed. The two are mutually exclusive in practice: see
 * detectCalendarEventReminders/detectCalendarEventHourlyReminders in
 * lib/notifications/detect-reminders.ts for how that's enforced at
 * read time, not enforced here at the schema level (a row could in
 * principle have both fields set; the detectors just agree on which
 * one wins so nothing double-fires).
 */
export const zHourlyReminderFields = z.object({
  // v3.7.2 — floor widened from 1 to 0: the Telegram "remind me in N
  // hours/minutes" feature (lib/telegram/parse-reminder.ts) computes a
  // real target instant directly from the message's own send time and
  // needs to say "remind right at that instant," not "at least an hour
  // before it." The manual Add Event/Recurring forms never offer 0 as
  // an option (see ReminderFields.tsx's LEAD_HOUR_OPTIONS, still
  // 1-4) — this only ever reaches the database via that one new path.
  remindLeadHours: z.coerce
    .number()
    .int()
    .min(0)
    .max(23)
    .nullable()
    .default(null),
});

const baseCalendarEventFields = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  tag: zEventTag,
  people: zEventPeople,
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  // v3.2.2 — optional: an event doesn't have to carry a specific time
  // to be worth saving, same reasoning notes has always had. Only
  // meaningful for an hour-based reminder (remindLeadHours) or a
  // future display enhancement; day-based reminders/display are
  // untouched by this being null.
  startTime: zTimeOfDay
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  // v3.6.8 — optional, and only meaningful once startTime is also set
  // (refineEndTimeNeedsStartTime below) — household request: a manual
  // event's own duration was always assumed to be 1 hour wherever one
  // was needed (the iCal feed), even for something that actually runs
  // 4 hours. Null keeps that same 1-hour-default behavior; every
  // reader falls back to it exactly like before this field existed.
  endTime: zTimeOfDay
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  notes: z.string().trim().max(1000).nullable().optional(),
  ...zReminderFields.shape,
  ...zHourlyReminderFields.shape,
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

/** An hour-based reminder needs a time to count backward from — reject the combination client- and server-side rather than silently falling back to some assumed hour. */
function refineHourlyNeedsStartTime<
  T extends { startTime: string | null; remindLeadHours: number | null },
>(value: T, ctx: z.RefinementCtx) {
  if (value.remindLeadHours !== null && !value.startTime) {
    ctx.addIssue({
      code: "custom",
      message: "Add a start time to use an hours-before reminder",
      path: ["remindLeadHours"],
    });
  }
}

/** An end time needs a start time to be relative to — same reasoning as refineHourlyNeedsStartTime, and enforced the same way (schema-level, not the database). */
function refineEndTimeNeedsStartTime<
  T extends { startTime: string | null; endTime: string | null },
>(value: T, ctx: z.RefinementCtx) {
  if (value.endTime !== null && !value.startTime) {
    ctx.addIssue({
      code: "custom",
      message: "Add a start time before setting an end time",
      path: ["endTime"],
    });
  }
}

/** Same-day only (this table has no notion of an event spanning past midnight) — a plain string comparison is safe since zTimeOfDay already guarantees zero-padded HH:MM for both. */
function refineEndTimeAfterStartTime<
  T extends { startTime: string | null; endTime: string | null },
>(value: T, ctx: z.RefinementCtx) {
  if (value.startTime && value.endTime && value.endTime <= value.startTime) {
    ctx.addIssue({
      code: "custom",
      message: "End time must be after the start time",
      path: ["endTime"],
    });
  }
}

function refineCalendarEvent(
  value: {
    startDate: string;
    endDate: string;
    startTime: string | null;
    endTime: string | null;
    remindLeadHours: number | null;
  },
  ctx: z.RefinementCtx,
) {
  refineDateOrder(value, ctx);
  refineHourlyNeedsStartTime(value, ctx);
  refineEndTimeNeedsStartTime(value, ctx);
  refineEndTimeAfterStartTime(value, ctx);
}

export const createCalendarEventInputSchema =
  baseCalendarEventFields.superRefine(refineCalendarEvent);
export type CreateCalendarEventInput = z.infer<
  typeof createCalendarEventInputSchema
>;

export const updateCalendarEventInputSchema = baseCalendarEventFields
  .extend({ id: z.uuid() })
  .superRefine(refineCalendarEvent);
export type UpdateCalendarEventInput = z.infer<
  typeof updateCalendarEventInputSchema
>;
