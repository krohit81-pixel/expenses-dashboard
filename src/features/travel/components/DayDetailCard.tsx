"use client";

import { Plane } from "lucide-react";

import { cn } from "@/lib/utils";
import { todayISODate } from "@/lib/dates/calendar-grid";
import { formatTimeRange } from "@/lib/dates/recurring-calendar-events";
import { TAG_BAR_STYLES } from "@/features/calendar/data";
import {
  chipsForDate,
  PersonNames,
  type Chip,
} from "@/features/travel/components/TripCalendarGrid";
import type { VisibilityFilter } from "@/features/travel/detailed-list";
import type { SchoolCalendarItem } from "@/features/travel/school-items";
import type { RecurringOccurrence } from "@/lib/dates/recurring-calendar-events";
import type { CalendarEvent } from "@/services/CalendarEventService";
import type { Trip } from "@/services/TripService";

function chipLabel(chip: Chip): string {
  if (chip.kind === "trip") return chip.trip.destination;
  if (chip.kind === "school") return chip.item.title;
  if (chip.kind === "manual") return chip.event.title;
  return chip.occurrence.title;
}
function chipBarColor(chip: Chip): string {
  if (chip.kind === "trip") return TAG_BAR_STYLES.trip;
  if (chip.kind === "school") return TAG_BAR_STYLES[chip.item.tag];
  if (chip.kind === "manual") return TAG_BAR_STYLES[chip.event.tag];
  return "bg-accent";
}
function chipPeople(chip: Chip): string[] {
  if (chip.kind === "trip") return chip.trip.travelerNames;
  if (chip.kind === "school")
    return [chip.item.person === "ahaana" ? "Ahaana" : "Rohana"];
  if (chip.kind === "manual") return chip.event.people;
  return chip.occurrence.people;
}

function formatHeading(dateISO: string) {
  const weekday = new Date(`${dateISO}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
  const month = new Date(`${dateISO}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    timeZone: "UTC",
  });
  const diffDays = Math.round(
    (new Date(`${dateISO}T00:00:00Z`).getTime() -
      new Date(`${todayISODate()}T00:00:00Z`).getTime()) /
      86400000,
  );
  const relative =
    diffDays === 0
      ? "Today"
      : diffDays > 0
        ? `In ${diffDays} day${diffDays === 1 ? "" : "s"}`
        : `${-diffDays} day${diffDays === -1 ? "" : "s"} ago`;
  return { weekday, sub: `${month} · ${relative}` };
}

/**
 * The tap-to-expand day card (v2.5.0) — replaces the full-screen
 * Outlook-style DayViewModal with an inline panel that opens right
 * below the tapped day (a grid cell in the month view, a row in the
 * week view), matching the design validated in the month/week-view
 * prototype. An "All day" section for trips/school items/manual events
 * (none of which carry a time of day) followed by a "Schedule" section
 * for recurring occurrences, sorted by start time — same all-day/timed
 * split DayViewModal used, just inline instead of a modal. Every row
 * except school items opens the same edit modals everything else on
 * /calendar uses.
 */
export function DayDetailCard({
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
  date: string;
  trips: Trip[];
  schoolItems: SchoolCalendarItem[];
  calendarEvents: CalendarEvent[];
  recurringOccurrences: RecurringOccurrence[];
  visible: VisibilityFilter;
  onTripClick: (tripId: string) => void;
  onEventClick: (eventId: string) => void;
  onRecurringClick: (ruleId: string) => void;
}) {
  const chips = chipsForDate(
    date,
    trips,
    schoolItems,
    calendarEvents,
    recurringOccurrences,
    visible,
  );
  const allDay = chips.filter((c) => c.kind !== "recurring");
  const timed = chips
    .filter(
      (c): c is Extract<Chip, { kind: "recurring" }> => c.kind === "recurring",
    )
    .map((c) => c.occurrence)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  function handleClick(chip: Chip) {
    if (chip.kind === "trip") onTripClick(chip.trip.id);
    else if (chip.kind === "manual") onEventClick(chip.event.id);
  }

  const { weekday, sub } = formatHeading(date);

  return (
    <div className="mt-1.5 rounded-[16px] bg-bg p-3.5">
      <div className="mb-2.5 flex items-baseline gap-2.5">
        <div className="font-display text-[26px] font-extrabold leading-none text-ink">
          {Number(date.slice(8, 10))}
        </div>
        <div>
          <div className="font-display text-[13px] font-extrabold uppercase text-ink">
            {weekday}
          </div>
          <div className="text-[10.5px] text-ink-faint">{sub}</div>
        </div>
      </div>

      {allDay.length > 0 && (
        <>
          <div className="mb-1.5 font-display text-[9px] font-extrabold uppercase tracking-wide text-ink-faint">
            All day
          </div>
          <div className="mb-2 space-y-1">
            {allDay.map((chip) => {
              const clickable = chip.kind !== "school";
              return (
                <button
                  key={chip.key}
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && handleClick(chip)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-[10px] bg-surface px-2.5 py-1.5 text-left",
                    clickable && "hover:opacity-80",
                  )}
                >
                  <span
                    className={cn(
                      "h-4 w-1 shrink-0 rounded-full",
                      chipBarColor(chip),
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-ink">
                    {chipLabel(chip)}
                  </span>
                  <PersonNames names={chipPeople(chip)} />
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
        </>
      )}

      <div className="mb-1.5 font-display text-[9px] font-extrabold uppercase tracking-wide text-ink-faint">
        Schedule
      </div>
      {timed.length === 0 ? (
        <p className="px-0.5 text-[11.5px] text-ink-faint">
          Nothing at a set time today
        </p>
      ) : (
        <div>
          {timed.map((occ) => (
            <button
              key={occ.key}
              type="button"
              onClick={() => onRecurringClick(occ.ruleId)}
              className="flex w-full items-center gap-2.5 rounded-[10px] px-1 py-1.5 text-left hover:bg-surface"
            >
              <span className="w-[58px] shrink-0 text-[10.5px] font-bold text-ink-faint">
                {formatTimeRange(occ.startTime, occ.endTime).split("–")[0]}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">
                {occ.title}
              </span>
              <PersonNames names={occ.people} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
