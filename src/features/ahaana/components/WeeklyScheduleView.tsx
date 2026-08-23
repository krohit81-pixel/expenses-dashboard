"use client";

import { useActionState, useState } from "react";
import { CalendarClock, Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { SectionHeading } from "@/features/dashboard/components/SectionHeading";
import {
  logAhaanaActivityAction,
  type LogAhaanaActivityFormState,
} from "@/features/ahaana/api/activity-actions";
import type { AhaanaOccurrence } from "@/lib/dates/ahaana-activities";
import type { AhaanaActivityLog } from "@/services/AhaanaActivityLogService";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CATEGORY_STYLE: Record<AhaanaOccurrence["category"], string> = {
  class: "bg-accent-soft text-accent",
  sport: "bg-teal-soft text-teal",
  study: "bg-amber-soft text-amber",
  other: "bg-bg text-ink-faint",
};

/** "6:00 PM" from a stored "HH:MM" — same 12-hour convention the reminder bodies use (lib/notifications/detect-reminders.ts's formatTime12h), duplicated here rather than shared since that helper lives in a server-only module this client component can't import. */
function formatTime12h(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatDayHeading(dateISO: string): string {
  const day = Number(dateISO.slice(8, 10));
  const monthShort = new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateISO}T00:00:00Z`));
  return `${day} ${monthShort}`;
}

const initialLogState: LogAhaanaActivityFormState = {};

function OccurrenceRow({
  occurrence,
  log,
}: {
  occurrence: AhaanaOccurrence;
  log: AhaanaActivityLog | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    logAhaanaActivityAction,
    initialLogState,
  );
  const isDone = Boolean(log) || state.success;

  return (
    <div className="rounded-[16px] border border-line bg-surface p-3.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 text-left"
      >
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 font-display text-[9.5px] font-extrabold uppercase tracking-wide ${CATEGORY_STYLE[occurrence.category]}`}
        >
          {occurrence.category}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[13.5px] font-bold text-ink">
            {occurrence.title}
          </div>
          <div className="text-[11px] text-ink-faint">
            {formatTime12h(occurrence.startTime)} –{" "}
            {formatTime12h(occurrence.endTime)}
          </div>
        </div>
        {isDone ? (
          <Check className="size-4 shrink-0 text-positive" />
        ) : (
          <ChevronDown
            className={`size-4 shrink-0 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {occurrence.planNotes && !open && !isDone && (
        <p className="mt-2 pl-[2px] text-[11px] leading-relaxed text-ink-faint">
          {occurrence.planNotes}
        </p>
      )}

      {isDone && (log?.coveredNotes ?? state.success) && (
        <div className="mt-2.5 space-y-1 border-t border-line pt-2.5 text-[11px] leading-relaxed">
          {log?.coveredNotes && (
            <p>
              <span className="font-bold text-ink-soft">Covered: </span>
              <span className="text-ink-faint">{log.coveredNotes}</span>
            </p>
          )}
          {log?.nextNotes && (
            <p>
              <span className="font-bold text-ink-soft">Next: </span>
              <span className="text-ink-faint">{log.nextNotes}</span>
            </p>
          )}
        </div>
      )}

      {!isDone && open && (
        <form action={formAction} className="mt-3 space-y-2.5">
          <input
            type="hidden"
            name="activityId"
            value={occurrence.activityId}
          />
          <input type="hidden" name="occurrenceDate" value={occurrence.date} />
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-ink-soft">
              What did you cover?
            </label>
            <textarea
              name="coveredNotes"
              rows={2}
              className="w-full rounded-xl border border-line bg-bg p-2.5 text-[13px] outline-none focus:border-accent"
              placeholder="e.g. Chapters 3–4, practice problems"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-ink-soft">
              What&apos;s next?{" "}
              <span className="font-normal text-ink-faint">(optional)</span>
            </label>
            <textarea
              name="nextNotes"
              rows={2}
              className="w-full rounded-xl border border-line bg-bg p-2.5 text-[13px] outline-none focus:border-accent"
              placeholder="e.g. Start chapter 5 next week"
            />
          </div>
          <FieldError message={state.error} />
          <Button type="submit" loading={isPending} className="w-full">
            <Check className="size-4" /> Mark complete
          </Button>
        </form>
      )}
    </div>
  );
}

export function WeeklyScheduleView({
  weekDates,
  occurrences,
  logs,
}: {
  weekDates: string[];
  occurrences: AhaanaOccurrence[];
  logs: AhaanaActivityLog[];
}) {
  const logByKey = new Map(
    logs.map((l) => [`${l.activityId}-${l.occurrenceDate}`, l]),
  );

  return (
    <div className="space-y-5">
      <SectionHeading
        index="01"
        title="This Week"
        meta={`${formatDayHeading(weekDates[0])} – ${formatDayHeading(weekDates[6])}`}
      />
      <div className="space-y-4">
        {weekDates.map((date, i) => {
          const dayOccurrences = occurrences.filter((o) => o.date === date);
          if (dayOccurrences.length === 0) return null;
          return (
            <div key={date}>
              <div className="mb-2 flex items-baseline gap-2">
                <span className="font-display text-[11px] font-extrabold uppercase tracking-wide text-ink-faint">
                  {DAY_NAMES[i]}
                </span>
                <span className="text-[11px] text-ink-faint">
                  {formatDayHeading(date)}
                </span>
              </div>
              <div className="space-y-2">
                {dayOccurrences.map((occurrence) => (
                  <OccurrenceRow
                    key={occurrence.key}
                    occurrence={occurrence}
                    log={logByKey.get(
                      `${occurrence.activityId}-${occurrence.date}`,
                    )}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {occurrences.length === 0 && (
          <div className="rounded-[16px] border border-dashed border-line p-6 text-center text-[12.5px] text-ink-faint">
            <CalendarClock className="mx-auto mb-2 size-6 text-ink-faint" />
            Nothing scheduled this week yet — add a recurring activity from
            &ldquo;Manage activities&rdquo; above.
          </div>
        )}
      </div>
    </div>
  );
}
