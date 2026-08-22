"use client";

import { Bell } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const LEAD_TIME_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "On the day" },
  { value: 1, label: "1 day before" },
  { value: 3, label: "3 days before" },
];

/**
 * v3.2.2 — only offered when `allowHourly` is true: a real start time
 * to count backward from (a recurring rule always has one; a plain
 * calendar event only once its own optional Time field is filled in —
 * see AddEventModal). Fixed at 3/4 hours per the household's explicit
 * request, not an open-ended picker — same "don't over-constrain a
 * column for a UI-level choice" reasoning LEAD_TIME_OPTIONS above
 * already follows; remind_lead_hours itself isn't constrained to
 * these two values at the database level.
 */
const LEAD_HOUR_OPTIONS: { value: number; label: string }[] = [
  { value: 3, label: "3 hours before" },
  { value: 4, label: "4 hours before" },
];

const DEFAULT_LEAD_HOURS = LEAD_HOUR_OPTIONS[0].value;

/**
 * The reminder toggle + lead-time select shared by AddEventModal,
 * AddTripModal, and AddRecurringEventModal (v3.2.0) — one component so
 * the three forms can't silently drift in how this looks or behaves.
 * A plain checkbox (this app has no dedicated Switch component yet),
 * styled like RecurringCycleTagger's bulk-tagging checkboxes
 * (size-[18px], accent-accent) rather than inventing a new toggle
 * style for one feature.
 *
 * Fires no notification by itself — this only ever sets
 * remindEnabled/remindLeadDays(/remindLeadHours) on the event/trip/rule
 * row via the form fields it renders. Whether anything actually gets
 * sent depends on a Telegram channel being linked in Settings and
 * ReminderService actually running (a manual button, plus a Vercel
 * Cron job on a timer as of v3.2.1) — see docs/00-current-state.md's
 * v3.2.0/v3.2.1/v3.2.2 sections.
 *
 * v3.2.2 — `allowHourly` adds a Days/Hours mode toggle on top of the
 * original day-only picker. Deliberately opt-in per call site rather
 * than always-on: AddTripModal never passes it (trips have no time
 * field and the household asked to keep trips day-before-only), so
 * that form's markup and submitted fields are byte-for-byte what they
 * were before this existed. When `allowHourly` is false/omitted, this
 * component's behavior is unchanged from pre-v3.2.2.
 */
export function ReminderFields({
  enabled,
  onEnabledChange,
  leadDays,
  onLeadDaysChange,
  leadHours = null,
  onLeadHoursChange,
  allowHourly = false,
  idPrefix,
}: {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  leadDays: number;
  onLeadDaysChange: (value: number) => void;
  /** Only meaningful when allowHourly is true. Non-null means "hours" mode is active. */
  leadHours?: number | null;
  onLeadHoursChange?: (value: number | null) => void;
  /** True only when a real start time exists to count backward from — see the component-level comment. */
  allowHourly?: boolean;
  idPrefix: string;
}) {
  const checkboxId = `${idPrefix}-remind-enabled`;
  const mode: "days" | "hours" =
    allowHourly && leadHours !== null ? "hours" : "days";

  return (
    <div className="space-y-2 rounded-[14px] border-[1.5px] border-line p-3">
      <label
        htmlFor={checkboxId}
        className="flex cursor-pointer items-center gap-2.5"
      >
        <input
          id={checkboxId}
          type="checkbox"
          name="remindEnabled"
          value="true"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="size-[18px] shrink-0 accent-accent"
        />
        <Bell className="size-4 shrink-0 text-ink-faint" />
        <span className="font-display text-[13px] font-bold text-ink">
          Remind me
        </span>
      </label>

      {enabled && (
        <div className="space-y-1.5 pl-[30px]">
          {allowHourly && (
            <div className="flex gap-1.5 pb-0.5">
              <button
                type="button"
                onClick={() => onLeadHoursChange?.(null)}
                className={cn(
                  "rounded-full px-2.5 py-1 font-display text-[11px] font-bold",
                  mode === "days"
                    ? "bg-accent text-white"
                    : "bg-bg text-ink-faint",
                )}
              >
                Days before
              </button>
              <button
                type="button"
                onClick={() =>
                  onLeadHoursChange?.(leadHours ?? DEFAULT_LEAD_HOURS)
                }
                className={cn(
                  "rounded-full px-2.5 py-1 font-display text-[11px] font-bold",
                  mode === "hours"
                    ? "bg-accent text-white"
                    : "bg-bg text-ink-faint",
                )}
              >
                Hours before
              </button>
            </div>
          )}

          {mode === "hours" ? (
            <>
              <Label htmlFor={`${idPrefix}-remind-lead-hours`}>When</Label>
              <Select
                id={`${idPrefix}-remind-lead-hours`}
                name="remindLeadHours"
                value={leadHours ?? DEFAULT_LEAD_HOURS}
                onChange={(e) => onLeadHoursChange?.(Number(e.target.value))}
              >
                {LEAD_HOUR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {/* remindLeadDays still has to be submitted (the schema
                  always expects it) even while hours mode is active —
                  the detector ignores it entirely once remindLeadHours
                  is set, see detect-reminders.ts. */}
              <input type="hidden" name="remindLeadDays" value={leadDays} />
            </>
          ) : (
            <>
              <Label htmlFor={`${idPrefix}-remind-lead-days`}>When</Label>
              <Select
                id={`${idPrefix}-remind-lead-days`}
                name="remindLeadDays"
                value={leadDays}
                onChange={(e) => onLeadDaysChange(Number(e.target.value))}
              >
                {LEAD_TIME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {/* Submitted empty (-> null after the schema's coerce)
                  so a row that was previously in hours mode actually
                  clears remindLeadHours when switched back to days. */}
              {allowHourly && (
                <input type="hidden" name="remindLeadHours" value="" />
              )}
            </>
          )}
        </div>
      )}
      {!enabled && (
        // A disabled reminder still needs remindLeadDays(/remindLeadHours)
        // submitted (the schema's zReminderFields/zHourlyReminderFields
        // always expect them, defaulted server-side too, but this keeps
        // the form's own FormData consistent with what gets saved either
        // way) — inert once remindEnabled is false, ReminderService
        // never looks at either for an event that isn't enabled.
        <>
          <input type="hidden" name="remindLeadDays" value={leadDays} />
          {allowHourly && (
            <input
              type="hidden"
              name="remindLeadHours"
              value={leadHours ?? ""}
            />
          )}
        </>
      )}
    </div>
  );
}
