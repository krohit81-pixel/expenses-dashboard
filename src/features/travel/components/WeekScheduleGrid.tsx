"use client";

import { cn } from "@/lib/utils";
import { getWeekDates, todayISODate } from "@/lib/dates/calendar-grid";
import {
  expandRecurringOccurrences,
  formatHourLabel,
  formatTimeRange,
  minutesOfDay,
  type RecurringOccurrence,
} from "@/lib/dates/recurring-calendar-events";
import { TAG_STYLES } from "@/features/calendar/data";
import {
  chipsForDate,
  PersonDots,
  type Chip,
} from "@/features/travel/components/TripCalendarGrid";
import {
  arePeopleVisible,
  type VisibilityFilter,
} from "@/features/travel/detailed-list";
import { travelerColorClass } from "@/features/travel/travelers";
import type { SchoolCalendarItem } from "@/features/travel/school-items";
import type { CalendarEvent } from "@/services/CalendarEventService";
import type { RecurringCalendarEvent } from "@/services/RecurringCalendarEventService";
import type { Trip } from "@/services/TripService";

const ROW_HEIGHT_PX = 40;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TRAVEL_STYLE = "bg-teal text-white";
const MAX_ALL_DAY_CHIPS = 2;

// Everything but "recurring" — the only kinds the all-day band ever
// holds, since recurring occurrences are the sole kind with a real
// time of day (see the split below). A named Extract, not just `Chip`,
// so chipLabel/chipStyle/chipPeople's if/else chains are exhaustive
// without needing to handle a "recurring" case that can't occur here.
type AllDayChip = Extract<Chip, { kind: "school" | "trip" | "manual" }>;

function chipLabel(chip: AllDayChip): string {
  if (chip.kind === "trip") return chip.trip.destination;
  if (chip.kind === "school") return chip.item.title;
  return chip.event.title;
}

function chipStyle(chip: AllDayChip): string {
  if (chip.kind === "trip") return TRAVEL_STYLE;
  return TAG_STYLES[chip.kind === "school" ? chip.item.tag : chip.event.tag];
}

function chipPeople(chip: AllDayChip): string[] {
  if (chip.kind === "trip") return chip.trip.travelerNames;
  if (chip.kind === "school")
    return [chip.item.person === "ahaana" ? "Ahaana" : "Rohana"];
  return chip.event.people;
}

/**
 * "This week's schedule" (v2.4.0) — merges what used to be two separate
 * widgets (RecurringWeekGrid's hourly timetable + WeekAgenda's "day by
 * day" text list) into one visual view: an "all day" band per column for
 * trips/school items/manual events (none of which carry a time of day),
 * and the hourly grid below it for recurring occurrences (the only kind
 * with a real start/end time) — same all-day/timed split DayViewModal
 * uses, just laid out across 7 columns instead of one. Lives in the
 * Dashboard section, always expanded (not collapsed by default) since
 * it's meant to be the at-a-glance view alongside the month grid.
 *
 * Recurring occurrences are re-expanded here client-side against *this
 * actual week* (not the server-computed range in props) so it stays
 * correct without a reload as days pass — same reasoning the old
 * RecurringWeekGrid had. Trips/school items/manual events don't have
 * that "goes stale at midnight" concern, so they're read straight from
 * the props the server already passed down.
 */
export function WeekScheduleGrid({
  rules,
  trips,
  schoolItems,
  calendarEvents,
  visible,
  onTripClick,
  onEventClick,
  onRecurringClick,
}: {
  rules: RecurringCalendarEvent[];
  trips: Trip[];
  schoolItems: SchoolCalendarItem[];
  calendarEvents: CalendarEvent[];
  visible: VisibilityFilter;
  onTripClick: (tripId: string) => void;
  onEventClick: (eventId: string) => void;
  onRecurringClick: (ruleId: string) => void;
}) {
  const weekDates = getWeekDates();
  const today = todayISODate();
  const visibleRules = rules.filter((rule) =>
    arePeopleVisible(rule.people, visible),
  );
  const occurrences = expandRecurringOccurrences(
    visibleRules,
    weekDates[0],
    weekDates[6],
  );

  const byDate = new Map<
    string,
    { allDay: AllDayChip[]; timed: RecurringOccurrence[] }
  >();
  for (const date of weekDates) {
    const chips = chipsForDate(
      date,
      trips,
      schoolItems,
      calendarEvents,
      occurrences,
      visible,
    );
    byDate.set(date, {
      allDay: chips.filter((c): c is AllDayChip => c.kind !== "recurring"),
      timed: chips
        .filter(
          (c): c is Extract<Chip, { kind: "recurring" }> =>
            c.kind === "recurring",
        )
        .map((c) => c.occurrence),
    });
  }

  const hasAnything = weekDates.some((date) => {
    const day = byDate.get(date);
    return (day?.allDay.length ?? 0) > 0 || (day?.timed.length ?? 0) > 0;
  });

  const startMinutes = occurrences.map((o) => minutesOfDay(o.startTime));
  const endMinutes = occurrences.map((o) => minutesOfDay(o.endTime));
  const minHour =
    occurrences.length > 0 ? Math.floor(Math.min(...startMinutes) / 60) : 0;
  const maxHour =
    occurrences.length > 0 ? Math.ceil(Math.max(...endMinutes) / 60) : 0;
  const hours = Array.from(
    { length: maxHour - minHour },
    (_, i) => minHour + i,
  );
  const gridHeight = hours.length * ROW_HEIGHT_PX;

  function handleClick(chip: Chip) {
    if (chip.kind === "trip") onTripClick(chip.trip.id);
    else if (chip.kind === "manual") onEventClick(chip.event.id);
  }

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-[15px] font-bold text-ink">
          This week&apos;s schedule
        </h2>
        <span className="text-[10.5px] text-ink-faint">
          {weekDates[0].slice(8, 10)}–{weekDates[6].slice(8, 10)}{" "}
          {new Date(`${weekDates[6]}T00:00:00Z`).toLocaleDateString("en-US", {
            month: "short",
            timeZone: "UTC",
          })}
        </span>
      </div>
      <div className="rounded-[20px] bg-surface p-3.5 shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
        <div className="flex">
          <div className="w-8 shrink-0" />
          {weekDates.map((date, i) => (
            <div
              key={date}
              className={cn(
                "flex-1 pb-2 text-center font-display text-[10px] font-bold uppercase tracking-wide text-ink-faint",
                date === today && "text-accent",
              )}
            >
              {DAY_LABELS[i]}
            </div>
          ))}
        </div>

        {!hasAnything && (
          <p className="pb-1 text-center text-[11.5px] text-ink-faint">
            Nothing scheduled this week
          </p>
        )}

        {hasAnything && (
          <div className="flex border-b border-line pb-2">
            <div className="w-8 shrink-0" />
            {weekDates.map((date) => {
              const allDay = byDate.get(date)?.allDay ?? [];
              const shown = allDay.slice(0, MAX_ALL_DAY_CHIPS);
              const overflow = allDay.length - shown.length;
              return (
                <div
                  key={date}
                  className="min-w-0 flex-1 space-y-[3px] px-[1px]"
                >
                  {shown.map((chip) => {
                    const clickable = chip.kind !== "school";
                    return (
                      <button
                        key={chip.key}
                        type="button"
                        disabled={!clickable}
                        onClick={() => clickable && handleClick(chip)}
                        title={chipLabel(chip)}
                        className={cn(
                          "flex w-full items-center gap-[3px] overflow-hidden rounded-full px-1 py-[1.5px] font-display text-[7.5px] font-bold leading-tight",
                          chipStyle(chip),
                        )}
                      >
                        <PersonDots names={chipPeople(chip)} />
                        <span className="min-w-0 truncate">
                          {chipLabel(chip)}
                        </span>
                      </button>
                    );
                  })}
                  {overflow > 0 && (
                    <div className="text-center text-[7px] font-semibold text-ink-faint">
                      +{overflow}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {occurrences.length > 0 && (
          <div className="flex pt-2">
            <div className="w-8 shrink-0">
              {hours.map((hour) => (
                <div
                  key={hour}
                  style={{ height: ROW_HEIGHT_PX }}
                  className="-translate-y-1.5 text-right text-[9.5px] font-semibold text-ink-faint"
                >
                  {formatHourLabel(hour)}
                </div>
              ))}
            </div>
            {weekDates.map((date) => (
              <div
                key={date}
                style={{ height: gridHeight }}
                className="relative flex-1 border-l border-line"
              >
                {hours.slice(1).map((hour) => (
                  <div
                    key={hour}
                    style={{ top: (hour - minHour) * ROW_HEIGHT_PX }}
                    className="absolute inset-x-0 h-px bg-line"
                  />
                ))}
                {byDate.get(date)?.timed.map((occurrence) => {
                  const top =
                    ((minutesOfDay(occurrence.startTime) - minHour * 60) / 60) *
                    ROW_HEIGHT_PX;
                  const height =
                    ((minutesOfDay(occurrence.endTime) -
                      minutesOfDay(occurrence.startTime)) /
                      60) *
                    ROW_HEIGHT_PX;
                  const color =
                    occurrence.people.length > 0
                      ? travelerColorClass(occurrence.people[0])
                      : "bg-accent";
                  return (
                    <button
                      key={occurrence.key}
                      type="button"
                      onClick={() => onRecurringClick(occurrence.ruleId)}
                      style={{ top, height }}
                      title={`${occurrence.title} · ${formatTimeRange(occurrence.startTime, occurrence.endTime)}${occurrence.mode ? ` · ${occurrence.mode}` : ""}`}
                      className={cn(
                        "absolute inset-x-[1px] overflow-hidden rounded-[6px] px-1 py-0.5 text-left text-[8.5px] font-extrabold leading-tight text-white",
                        color,
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-[3px] truncate">
                        <PersonDots names={occurrence.people} />
                        <span className="min-w-0 truncate">
                          {occurrence.title}
                        </span>
                      </span>
                      <span className="block truncate text-[7.5px] font-bold opacity-85">
                        {formatTimeRange(
                          occurrence.startTime,
                          occurrence.endTime,
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
