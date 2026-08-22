"use client";

import { Bell } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const LEAD_TIME_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "On the day" },
  { value: 1, label: "1 day before" },
  { value: 3, label: "3 days before" },
];

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
 * remindEnabled/remindLeadDays on the event/trip/rule row via the
 * two form fields it renders. Whether anything actually gets sent
 * depends on a Telegram channel being linked in Settings and
 * ReminderService actually running (manually today, on a cron once
 * that's wired up) — see docs/00-current-state.md's v3.2.0 section.
 */
export function ReminderFields({
  enabled,
  onEnabledChange,
  leadDays,
  onLeadDaysChange,
  idPrefix,
}: {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  leadDays: number;
  onLeadDaysChange: (value: number) => void;
  idPrefix: string;
}) {
  const checkboxId = `${idPrefix}-remind-enabled`;

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
        </div>
      )}
      {!enabled && (
        // A disabled reminder still needs remindLeadDays submitted
        // (the schema's zReminderFields always expects it, defaulted
        // server-side too, but this keeps the form's own FormData
        // consistent with what gets saved either way) — 0 is inert
        // once remindEnabled is false, ReminderService never looks at
        // it for an event that isn't enabled.
        <input type="hidden" name="remindLeadDays" value={leadDays} />
      )}
    </div>
  );
}
