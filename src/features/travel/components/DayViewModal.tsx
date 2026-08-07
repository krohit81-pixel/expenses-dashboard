"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plane, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { shiftDate } from "@/lib/dates/calendar-grid";
import {
  formatHourLabel,
  formatTimeRange,
  minutesOfDay,
} from "@/lib/dates/recurring-calendar-events";
import { TAG_LABELS, TAG_STYLES } from "@/features/calendar/data";
import {
  chipsForDate,
  type Chip,
} from "@/features/travel/components/TripCalendarGrid";
import type { VisibilityFilter } from "@/features/travel/detailed-list";
import type { SchoolCalendarItem } from "@/features/travel/school-items";
import type { RecurringOccurrence } from "@/lib/dates/recurring-calendar-events";
import type { CalendarEvent } from "@/services/CalendarEventService";
import type { Trip } from "@/services/TripService";

const ROW_HEIGHT_PX = 48;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const TRAVEL_STYLE = "bg-teal text-white";
const RECURRING_STYLE = "bg-accent text-white";

function chipLabel(chip: Chip): string {
  if (chip.kind === "trip") return chip.trip.destination;
  if (chip.kind === "school") return chip.item.title;
  if (chip.kind === "manual") return chip.event.title;
  return chip.occurrence.title;
}

function chipTagStyle(chip: Chip): string {
  if (chip.kind === "trip") return TRAVEL_STYLE;
  if (chip.kind === "recurring") return RECURRING_STYLE;
  return TAG_STYLES[chip.kind === "school" ? chip.item.tag : chip.event.tag];
}

function chipTagLabel(chip: Chip): string {
  if (chip.kind === "trip") return "Travel";
  if (chip.kind === "recurring") return "Recurring";
  return TAG_LABELS[chip.kind === "school" ? chip.item.tag : chip.event.tag];
}

function formatDayTitle(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Outlook-style single-day view (v2.3.0) — replaces the old "click an
 * empty day to add a trip, click a chip to edit it directly" behavior on
 * the month grid. Every day cell now opens this instead (see
 * TripCalendarGrid): full-day items (school/trip/manual — none of them
 * carry a time of day) sit in an "All day" band up top, recurring
 * occurrences (the only item kind with a real time) are positioned on a
 * 24-hour timeline below, and prev/next arrows let you flip through days
 * without closing and reopening. Adding something new happens through
 * the Logging section now, not from here — this view is read + edit
 * (tap an item to open its edit modal), not create.
 */
export function DayViewModal({
  open,
  onClose,
  date,
  trips,
  schoolItems,
  calendarEvents,
  recurringOccurrences,
  visible,
  onTripClick,
  onEventClick,
  onRecurringClick,
}: {
  open: boolean;
  onClose: () => void;
  date: string | null;
  trips: Trip[];
  schoolItems: SchoolCalendarItem[];
  calendarEvents: CalendarEvent[];
  recurringOccurrences: RecurringOccurrence[];
  visible: VisibilityFilter;
  onTripClick: (tripId: string) => void;
  onEventClick: (eventId: string) => void;
  onRecurringClick: (ruleId: string) => void;
}) {
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && date) setActiveDate(date);
  }, [open, date]);

  // Land somewhere near the start of the school/work day rather than
  // the literal midnight top of a 24-row list — 7am if nothing's
  // scheduled earlier that morning, or the earliest occurrence's hour
  // if it starts before 7am.
  useEffect(() => {
    if (!open || !activeDate || !timelineRef.current) return;
    const dayOccurrences = recurringOccurrences.filter(
      (o) => o.date === activeDate,
    );
    const earliestMinute =
      dayOccurrences.length > 0
        ? Math.min(...dayOccurrences.map((o) => minutesOfDay(o.startTime)))
        : 7 * 60;
    const scrollToMinute = Math.min(earliestMinute, 7 * 60);
    timelineRef.current.scrollTop = (scrollToMinute / 60) * ROW_HEIGHT_PX;
    // Re-run whenever the modal opens on a (possibly new) date — not on
    // every recurringOccurrences identity change, which is a fresh array
    // from the server on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeDate]);

  if (!open || !activeDate) return null;

  const chips = chipsForDate(
    activeDate,
    trips,
    schoolItems,
    calendarEvents,
    recurringOccurrences,
    visible,
  );
  const allDayChips = chips.filter((c) => c.kind !== "recurring");
  const timedChips = chips.filter(
    (c): c is Extract<Chip, { kind: "recurring" }> => c.kind === "recurring",
  );

  function handleClick(chip: Chip) {
    if (chip.kind === "trip") onTripClick(chip.trip.id);
    else if (chip.kind === "manual") onEventClick(chip.event.id);
    else if (chip.kind === "recurring")
      onRecurringClick(chip.occurrence.ruleId);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[22px] bg-surface sm:rounded-[22px]">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => setActiveDate((d) => (d ? shiftDate(d, -1) : d))}
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-bg text-ink-soft"
          >
            <ChevronLeft className="size-4" />
          </button>
          <h2 className="min-w-0 flex-1 truncate px-2 text-center font-display text-[13.5px] font-extrabold text-ink">
            {formatDayTitle(activeDate)}
          </h2>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              aria-label="Next day"
              onClick={() => setActiveDate((d) => (d ? shiftDate(d, 1) : d))}
              className="flex size-7 items-center justify-center rounded-full bg-bg text-ink-soft"
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="ml-1 flex size-7 items-center justify-center rounded-full bg-bg text-ink-soft"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {allDayChips.length > 0 && (
          <div className="space-y-1.5 border-b border-line px-5 py-3">
            <div className="font-display text-[9.5px] font-extrabold uppercase tracking-wide text-ink-faint">
              All day
            </div>
            {allDayChips.map((chip) => {
              const clickable = chip.kind !== "school";
              return (
                <button
                  key={chip.key}
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && handleClick(chip)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-left",
                    clickable ? "hover:bg-bg" : "cursor-default",
                  )}
                >
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 font-display text-[8.5px] font-extrabold uppercase tracking-wide",
                      chipTagStyle(chip),
                    )}
                  >
                    {chipTagLabel(chip)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">
                    {chipLabel(chip)}
                  </span>
                  {chip.kind === "trip" && chip.trip.flight && (
                    <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-ink-faint">
                      <Plane className="size-2.5" />
                      {chip.trip.flight}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div ref={timelineRef} className="flex-1 overflow-y-auto px-5 py-3">
          <div
            className="relative flex"
            style={{ height: HOURS.length * ROW_HEIGHT_PX }}
          >
            <div className="w-11 shrink-0">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  style={{ height: ROW_HEIGHT_PX }}
                  className="-translate-y-1.5 text-right text-[10px] font-semibold text-ink-faint"
                >
                  {formatHourLabel(hour)}
                </div>
              ))}
            </div>
            <div className="relative flex-1 border-l border-line">
              {HOURS.slice(1).map((hour) => (
                <div
                  key={hour}
                  style={{ top: hour * ROW_HEIGHT_PX }}
                  className="absolute inset-x-0 h-px bg-line"
                />
              ))}
              {timedChips.length === 0 && (
                <p className="pl-3 pt-1 text-[11.5px] text-ink-faint">
                  Nothing at a set time today
                </p>
              )}
              {timedChips.map((chip) => {
                const top =
                  (minutesOfDay(chip.occurrence.startTime) / 60) *
                  ROW_HEIGHT_PX;
                const height =
                  ((minutesOfDay(chip.occurrence.endTime) -
                    minutesOfDay(chip.occurrence.startTime)) /
                    60) *
                  ROW_HEIGHT_PX;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => handleClick(chip)}
                    style={{ top, height, minHeight: 22 }}
                    className={cn(
                      "absolute inset-x-1 overflow-hidden rounded-[8px] px-2 py-1 text-left text-[10.5px] font-bold leading-tight text-white",
                      RECURRING_STYLE,
                    )}
                  >
                    <span className="block truncate">
                      {chip.occurrence.title}
                    </span>
                    <span className="block truncate text-[9px] font-semibold opacity-85">
                      {formatTimeRange(
                        chip.occurrence.startTime,
                        chip.occurrence.endTime,
                      )}
                      {chip.occurrence.mode ? ` · ${chip.occurrence.mode}` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
