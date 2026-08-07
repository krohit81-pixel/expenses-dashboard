"use client";

import { cn } from "@/lib/utils";
import { getWeekDates, todayISODate } from "@/lib/dates/calendar-grid";
import { formatTimeRange } from "@/lib/dates/recurring-calendar-events";
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

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TRAVEL_STYLE = "bg-teal text-white";
const RECURRING_STYLE = "bg-accent text-white";

function chipLabel(chip: Chip): string {
  if (chip.kind === "trip") return chip.trip.destination;
  if (chip.kind === "school") return chip.item.title;
  if (chip.kind === "manual") return chip.event.title;
  return chip.occurrence.title;
}

function chipStyle(chip: Chip): string {
  if (chip.kind === "trip") return TRAVEL_STYLE;
  if (chip.kind === "recurring") return RECURRING_STYLE;
  return TAG_STYLES[chip.kind === "school" ? chip.item.tag : chip.event.tag];
}

function chipMeta(chip: Chip): string | null {
  if (chip.kind === "recurring") {
    const range = formatTimeRange(
      chip.occurrence.startTime,
      chip.occurrence.endTime,
    );
    return chip.occurrence.mode ? `${range} · ${chip.occurrence.mode}` : range;
  }
  if (chip.kind === "trip" && chip.trip.flight) return chip.trip.flight;
  return null;
}

/**
 * "This week, day by day" (v2.2.2) — the compact 7-row agenda from the
 * /calendar recurring-events prototype that didn't make it into the
 * v2.2.0 build: recurring occurrences were folded into the existing
 * "Detailed calendar events" list instead, which is collapsed by
 * default and spans every month chronologically rather than showing
 * just the current week at a glance. This sits between RecurringWeekGrid
 * (the timetable pattern view) and the month grid, reusing the exact
 * same chipsForDate() the month grid uses so a day's contents and
 * visibility rules never diverge between the two views.
 */
export function WeekAgenda({
  trips,
  schoolItems,
  calendarEvents,
  recurringOccurrences,
  visible,
  onTripClick,
  onEventClick,
  onRecurringClick,
}: {
  trips: Trip[];
  schoolItems: SchoolCalendarItem[];
  calendarEvents: CalendarEvent[];
  recurringOccurrences: RecurringOccurrence[];
  visible: VisibilityFilter;
  onTripClick: (tripId: string) => void;
  onEventClick: (eventId: string) => void;
  onRecurringClick: (ruleId: string) => void;
}) {
  const weekDates = getWeekDates();
  const today = todayISODate();

  function handleClick(chip: Chip) {
    if (chip.kind === "trip") onTripClick(chip.trip.id);
    else if (chip.kind === "manual") onEventClick(chip.event.id);
    else if (chip.kind === "recurring")
      onRecurringClick(chip.occurrence.ruleId);
  }

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-[15px] font-bold text-ink">
          This week, day by day
        </h2>
      </div>
      <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
        {weekDates.map((date, i) => {
          const chips = chipsForDate(
            date,
            trips,
            schoolItems,
            calendarEvents,
            recurringOccurrences,
            visible,
          );
          const isToday = date === today;
          return (
            <div
              key={date}
              className="flex gap-3 border-b border-line px-[18px] py-3 last:border-b-0"
            >
              <div className="w-9 shrink-0 text-center">
                <div
                  className={cn(
                    "font-display text-[9px] font-extrabold uppercase tracking-wide",
                    isToday ? "text-accent" : "text-ink-faint",
                  )}
                >
                  {DAY_LABELS[i]}
                </div>
                <div
                  className={cn(
                    "font-display text-[15px] font-extrabold",
                    isToday ? "text-accent" : "text-ink",
                  )}
                >
                  {Number(date.slice(8, 10))}
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                {chips.length === 0 ? (
                  <p className="pt-0.5 text-[11.5px] text-ink-faint">
                    Nothing scheduled
                  </p>
                ) : (
                  chips.map((chip) => {
                    const clickable = chip.kind !== "school";
                    const meta = chipMeta(chip);
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
                            chipStyle(chip),
                          )}
                        >
                          {chip.kind === "trip"
                            ? "Travel"
                            : chip.kind === "recurring"
                              ? "Recurring"
                              : TAG_LABELS[
                                  chip.kind === "school"
                                    ? chip.item.tag
                                    : chip.event.tag
                                ]}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">
                          {chipLabel(chip)}
                        </span>
                        {meta && (
                          <span className="shrink-0 text-[10px] font-semibold text-ink-faint">
                            {meta}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
