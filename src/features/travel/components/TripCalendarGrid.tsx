"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plane } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  getMonthGridDates,
  isInMonth,
  todayISODate,
} from "@/lib/dates/calendar-grid";
import { monthLabel, shiftMonth } from "@/lib/dates/month";
import { truncate } from "@/lib/text";
import {
  TAG_BAR_STYLES,
  TAG_LABELS,
  TAG_STYLES,
} from "@/features/calendar/data";
import type { EventTag } from "@/features/calendar/data";
import { ChipBadge } from "@/features/travel/components/ChipBadge";
import { DayDetailCard } from "@/features/travel/components/DayDetailCard";
import { travelerColorClass } from "@/features/travel/travelers";
import {
  arePeopleVisible,
  isTripVisible,
  type VisibilityFilter,
} from "@/features/travel/detailed-list";
import type { SchoolCalendarItem } from "@/features/travel/school-items";
import type { RecurringOccurrence } from "@/lib/dates/recurring-calendar-events";
import type { CalendarEvent } from "@/services/CalendarEventService";
import type { Trip } from "@/services/TripService";

const TRAVEL_STYLE = "bg-teal text-white";
const MAX_CHIPS_PER_DAY = 2;
/** Chips are ~9px text in an 84px-tall day cell — three stacked dots is
 * about the ceiling before they blur into a solid smear rather than
 * reading as separate people. A trip with more travellers than this
 * still lists everyone in the chip's title tooltip. */
const MAX_PERSON_DOTS = 3;

/** Tiny colored dot per person on a chip — who's part of this event,
 * at a glance, without opening it. Trips can have several travellers
 * (Rohit, Aradhana, a custom name, ...); school items only ever have
 * one (Ahaana or Rohana), so that case is always a single dot.
 * Exported (v2.4.0) so DayDetailCard can reuse the same dots on its
 * all-day rows rather than re-implementing them. */
export function PersonDots({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <span className="flex shrink-0 items-center -space-x-[3px]">
      {names.slice(0, MAX_PERSON_DOTS).map((name) => (
        <span
          key={name}
          className={cn(
            "size-[6px] shrink-0 rounded-full ring-1 ring-surface",
            travelerColorClass(name),
          )}
        />
      ))}
    </span>
  );
}

/** Exported (v2.2.2) so DayDetailCard and WeekScheduleGrid can build the
 * same per-day item list without re-deriving their own visibility/range
 * logic — one "what's on this date" function, shared by every calendar
 * view. */
export type Chip =
  | { kind: "school"; key: string; item: SchoolCalendarItem }
  | { kind: "trip"; key: string; trip: Trip }
  | { kind: "manual"; key: string; event: CalendarEvent }
  | { kind: "recurring"; key: string; occurrence: RecurringOccurrence };

export function chipsForDate(
  dateISO: string,
  trips: Trip[],
  schoolItems: SchoolCalendarItem[],
  calendarEvents: CalendarEvent[],
  recurringOccurrences: RecurringOccurrence[],
  visible: VisibilityFilter,
): Chip[] {
  const chips: Chip[] = [];

  for (const trip of trips) {
    if (!isTripVisible(trip, visible)) continue;
    if (dateISO >= trip.startDate && dateISO <= trip.endDate) {
      chips.push({ kind: "trip", key: `trip-${trip.id}`, trip });
    }
  }
  for (const item of schoolItems) {
    if (!visible[item.person]) continue;
    if (dateISO >= item.startDate && dateISO <= item.endDate) {
      chips.push({
        kind: "school",
        key: `${item.person}-${item.title}-${item.startDate}`,
        item,
      });
    }
  }
  // Manual events aren't tied to Ahaana/Rohana/Travel — only the
  // Rohit/Aradhana person filters can hide one, and only if it's
  // tagged to a person those filters cover (see arePeopleVisible).
  for (const event of calendarEvents) {
    if (!arePeopleVisible(event.people, visible)) continue;
    if (dateISO >= event.startDate && dateISO <= event.endDate) {
      chips.push({ kind: "manual", key: `manual-${event.id}`, event });
    }
  }
  // Occurrences are already single-date (expanded from a rule) — an
  // exact match, not a range check like the others above.
  for (const occurrence of recurringOccurrences) {
    if (!arePeopleVisible(occurrence.people, visible)) continue;
    if (occurrence.date === dateISO) {
      chips.push({
        kind: "recurring",
        key: `recurring-${occurrence.key}`,
        occurrence,
      });
    }
  }
  return chips;
}

/** A single ready-to-render chip for compact spaces (the month grid, the
 * week list) — everything chipsForDate returns, except same-day
 * recurring occurrences collapse into one "N classes" summary instead of
 * one chip each. These compact views were never meant to be clickable
 * per item anyway (tapping the day opens DayDetailCard, where each
 * occurrence gets its own row and its own click target), so merging
 * loses nothing and stops a class-heavy day from dwarfing the days
 * around it — the exact problem the old one-chip-per-occurrence
 * rendering had. */
export interface DisplayChip {
  key: string;
  label: string;
  barColorClass: string;
}

function tagBarColor(tag: EventTag): string {
  return TAG_BAR_STYLES[tag];
}

export function compactChipsForDate(
  dateISO: string,
  trips: Trip[],
  schoolItems: SchoolCalendarItem[],
  calendarEvents: CalendarEvent[],
  recurringOccurrences: RecurringOccurrence[],
  visible: VisibilityFilter,
): DisplayChip[] {
  const chips = chipsForDate(
    dateISO,
    trips,
    schoolItems,
    calendarEvents,
    recurringOccurrences,
    visible,
  );
  const display: DisplayChip[] = [];
  for (const chip of chips) {
    if (chip.kind === "trip") {
      display.push({
        key: chip.key,
        label: chip.trip.destination,
        barColorClass: TAG_BAR_STYLES.trip,
      });
    } else if (chip.kind === "school") {
      display.push({
        key: chip.key,
        label: chip.item.title,
        barColorClass: tagBarColor(chip.item.tag),
      });
    } else if (chip.kind === "manual") {
      display.push({
        key: chip.key,
        label: chip.event.title,
        barColorClass: tagBarColor(chip.event.tag),
      });
    }
  }
  const recurring = chips.filter(
    (c): c is Extract<Chip, { kind: "recurring" }> => c.kind === "recurring",
  );
  if (recurring.length > 0) {
    const person = recurring[0].occurrence.people[0];
    display.push({
      key: `recurring-summary-${dateISO}`,
      label:
        recurring.length === 1
          ? recurring[0].occurrence.title
          : `${recurring.length} classes`,
      barColorClass: person ? travelerColorClass(person) : "bg-accent",
    });
  }
  return display;
}

/**
 * v2.5.0: tapping a day now expands DayDetailCard right below that
 * week, instead of opening the full-screen DayViewModal (v2.3.0) — a
 * sleeker interaction validated in the month/week-view prototype. That
 * meant giving up the single continuous 42-cell CSS grid for six
 * discrete week rows instead, so a card can be inserted after the right
 * one. Chips also switched to the "bold top bar" style (ChipBadge) and
 * same-day recurring occurrences collapse into one summary chip
 * (compactChipsForDate) — see those for why.
 */
export function TripCalendarGrid({
  month,
  onMonthChange,
  trips,
  schoolItems,
  calendarEvents,
  recurringOccurrences,
  visible,
  onTripClick,
  onEventClick,
  onRecurringClick,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  trips: Trip[];
  schoolItems: SchoolCalendarItem[];
  calendarEvents: CalendarEvent[];
  recurringOccurrences: RecurringOccurrence[];
  visible: VisibilityFilter;
  onTripClick: (tripId: string) => void;
  onEventClick: (eventId: string) => void;
  onRecurringClick: (ruleId: string) => void;
}) {
  const dates = getMonthGridDates(month);
  const today = todayISODate();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const weeks = Array.from({ length: 6 }, (_, i) =>
    dates.slice(i * 7, i * 7 + 7),
  );

  return (
    <div className="rounded-[20px] bg-surface p-4 shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)] sm:p-5">
      <div className="mb-3.5 flex items-center justify-between">
        <div className="font-display text-[15px] font-bold text-ink">
          {monthLabel(month)}
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onMonthChange(shiftMonth(month, -1))}
            className="flex size-8 items-center justify-center rounded-full border border-line text-ink-soft hover:bg-bg"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => onMonthChange(shiftMonth(month, 1))}
            className="flex size-8 items-center justify-center rounded-full border border-line text-ink-soft hover:bg-bg"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div
            key={d}
            className="pb-1 text-center font-display text-[10px] font-bold uppercase tracking-wide text-ink-faint"
          >
            {d}
          </div>
        ))}
      </div>

      {weeks.map((week) => (
        <div key={week[0]} className="mb-[3px]">
          <div className="grid grid-cols-7 gap-[3px]">
            {week.map((dateISO) => {
              const chips = compactChipsForDate(
                dateISO,
                trips,
                schoolItems,
                calendarEvents,
                recurringOccurrences,
                visible,
              );
              const shown = chips.slice(0, MAX_CHIPS_PER_DAY);
              const overflow = chips.length - shown.length;
              const dayNumber = Number(dateISO.slice(8, 10));

              return (
                <div
                  key={dateISO}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setSelectedDate((d) => (d === dateISO ? null : dateISO))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedDate((d) => (d === dateISO ? null : dateISO));
                    }
                  }}
                  className={cn(
                    "flex min-h-[84px] flex-col gap-[3px] rounded-[10px] bg-bg p-1 text-left",
                    !isInMonth(dateISO, month) && "opacity-30",
                    dateISO === today && "ring-[1.5px] ring-inset ring-accent",
                    dateISO === selectedDate &&
                      "ring-[1.5px] ring-inset ring-ink",
                  )}
                >
                  <span className="font-display text-[10.5px] font-bold text-ink-soft">
                    {dayNumber}
                  </span>
                  {shown.map((chip) => (
                    <ChipBadge
                      key={chip.key}
                      label={truncate(chip.label, 12)}
                      barColorClass={chip.barColorClass}
                      size="sm"
                    />
                  ))}
                  {overflow > 0 && (
                    <span className="text-[8px] font-semibold text-ink-faint">
                      +{overflow} more
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {selectedDate && week.includes(selectedDate) && (
            <DayDetailCard
              date={selectedDate}
              trips={trips}
              schoolItems={schoolItems}
              calendarEvents={calendarEvents}
              recurringOccurrences={recurringOccurrences}
              visible={visible}
              onTripClick={onTripClick}
              onEventClick={onEventClick}
              onRecurringClick={onRecurringClick}
            />
          )}
        </div>
      ))}

      <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {(["vacation", "holiday", "exam", "event"] as EventTag[]).map((tag) => (
          <LegendItem
            key={tag}
            className={TAG_STYLES[tag]}
            label={TAG_LABELS[tag]}
          />
        ))}
        <LegendItem className={TRAVEL_STYLE} label="Booked travel" icon />
        <LegendItem
          className="bg-sky text-white"
          label="Recurring (by person)"
        />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
        Tap any day to see it in full, right below that week. Add a trip, event,
        or recurring item from Logging below.
      </p>
    </div>
  );
}

function LegendItem({
  className,
  label,
  icon,
}: {
  className: string;
  label: string;
  icon?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-ink-soft">
      <span
        className={cn(
          "flex h-3.5 w-5 items-center justify-center rounded-full",
          className,
        )}
      >
        {icon && <Plane className="size-2.5" />}
      </span>
      {label}
    </div>
  );
}
