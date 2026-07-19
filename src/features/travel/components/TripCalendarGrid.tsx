"use client";

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
  TAG_LABELS,
  TAG_STYLES,
  type EventTag,
} from "@/features/calendar/data";
import { travelerColorClass } from "@/features/travel/travelers";
import {
  arePeopleVisible,
  isTripVisible,
  type VisibilityFilter,
} from "@/features/travel/detailed-list";
import type { SchoolCalendarItem } from "@/features/travel/school-items";
import type { CalendarEvent } from "@/services/CalendarEventService";
import type { Trip } from "@/services/TripService";

const TRAVEL_STYLE = "bg-teal text-white";
const MAX_CHIPS_PER_DAY = 3;
const PERSON_NAME = { ahaana: "Ahaana", rohana: "Rohana" } as const;
/** Chips are ~9px text in an 84px-tall day cell — three stacked dots is
 * about the ceiling before they blur into a solid smear rather than
 * reading as separate people. A trip with more travellers than this
 * still lists everyone in the chip's title tooltip. */
const MAX_PERSON_DOTS = 3;

/** Tiny colored dot per person on a chip — who's part of this event,
 * at a glance, without opening it. Trips can have several travellers
 * (Rohit, Aradhana, a custom name, ...); school items only ever have
 * one (Ahaana or Rohana), so that case is always a single dot. */
function PersonDots({ names }: { names: string[] }) {
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

type Chip =
  | { kind: "school"; key: string; item: SchoolCalendarItem }
  | { kind: "trip"; key: string; trip: Trip }
  | { kind: "manual"; key: string; event: CalendarEvent };

function chipsForDate(
  dateISO: string,
  trips: Trip[],
  schoolItems: SchoolCalendarItem[],
  calendarEvents: CalendarEvent[],
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
  return chips;
}

export function TripCalendarGrid({
  month,
  onMonthChange,
  trips,
  schoolItems,
  calendarEvents,
  visible,
  onDayClick,
  onTripClick,
  onEventClick,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  trips: Trip[];
  schoolItems: SchoolCalendarItem[];
  calendarEvents: CalendarEvent[];
  visible: VisibilityFilter;
  onDayClick: (dateISO: string) => void;
  onTripClick: (tripId: string) => void;
  onEventClick: (eventId: string) => void;
}) {
  const dates = getMonthGridDates(month);
  const today = todayISODate();

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

      <div className="grid grid-cols-7 gap-[3px]">
        {dates.map((dateISO) => {
          const chips = chipsForDate(
            dateISO,
            trips,
            schoolItems,
            calendarEvents,
            visible,
          );
          const shown = chips.slice(0, MAX_CHIPS_PER_DAY);
          const overflow = chips.length - shown.length;
          const dayNumber = Number(dateISO.slice(8, 10));

          const isEmpty = chips.length === 0;

          // v1.2: this used to be one <button> around the whole cell,
          // with a click handler that always resolved to the *first*
          // trip (or first manual event) via .find() — tapping the
          // second or third chip on a busy day silently opened the
          // first one instead, which is exactly what got reported.
          // A <button> also can't correctly contain other interactive
          // elements, so the fix is: the cell itself is a <div> (only
          // clickable, as "add a trip here", when it has no chips at
          // all), and every trip/manual chip is its own button that
          // stops the click from reaching the cell. School chips stay
          // non-interactive spans — they're read-only static data, same
          // as before.
          return (
            <div
              key={dateISO}
              role={isEmpty ? "button" : undefined}
              tabIndex={isEmpty ? 0 : undefined}
              onClick={isEmpty ? () => onDayClick(dateISO) : undefined}
              onKeyDown={
                isEmpty
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onDayClick(dateISO);
                      }
                    }
                  : undefined
              }
              className={cn(
                "flex min-h-[84px] flex-col gap-[3px] rounded-[10px] bg-bg p-1 text-left",
                !isInMonth(dateISO, month) && "opacity-30",
                dateISO === today && "ring-[1.5px] ring-inset ring-accent",
              )}
            >
              <span className="font-display text-[10.5px] font-bold text-ink-soft">
                {dayNumber}
              </span>

              {shown.map((chip) => {
                if (chip.kind === "manual") {
                  const isStart = dateISO === chip.event.startDate;
                  const isEnd = dateISO === chip.event.endDate;
                  const label = truncate(chip.event.title, 15);
                  return (
                    <button
                      type="button"
                      key={chip.key}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(chip.event.id);
                      }}
                      title={`${chip.event.title}${chip.event.people.length > 0 ? ` — ${chip.event.people.join(", ")}` : ""}`}
                      className={cn(
                        "flex items-center gap-1 rounded px-1 py-[1.5px] font-display text-[9px] font-bold",
                        TAG_STYLES[chip.event.tag],
                        isStart && "rounded-l-full",
                        isEnd && "rounded-r-full",
                      )}
                    >
                      <PersonDots names={chip.event.people} />
                      <span className="min-w-0 truncate">{label}</span>
                    </button>
                  );
                }

                if (chip.kind === "trip") {
                  const isStart = dateISO === chip.trip.startDate;
                  const isEnd = dateISO === chip.trip.endDate;
                  const label = truncate(
                    `${chip.trip.destination}${chip.trip.flight ? ` · ${chip.trip.flight}` : ""}`,
                    15,
                  );
                  return (
                    <button
                      type="button"
                      key={chip.key}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTripClick(chip.trip.id);
                      }}
                      title={`${chip.trip.destination}${chip.trip.flight ? ` · ${chip.trip.flight}` : ""}${chip.trip.travelerNames.length > 0 ? ` — ${chip.trip.travelerNames.join(", ")}` : ""}`}
                      className={cn(
                        "flex items-center gap-1 rounded px-1 py-[1.5px] font-display text-[9px] font-bold",
                        TRAVEL_STYLE,
                        isStart && "rounded-l-full",
                        isEnd && "rounded-r-full",
                      )}
                    >
                      <PersonDots names={chip.trip.travelerNames} />
                      <span className="min-w-0 truncate">{label}</span>
                    </button>
                  );
                }

                const isStart = dateISO === chip.item.startDate;
                const isEnd = dateISO === chip.item.endDate;
                const label = truncate(chip.item.title, 15);
                const personName = PERSON_NAME[chip.item.person];
                return (
                  <span
                    key={chip.key}
                    title={`${chip.item.title} (${personName})`}
                    className={cn(
                      "flex items-center gap-1 rounded px-1 py-[1.5px] font-display text-[9px] font-bold",
                      TAG_STYLES[chip.item.tag],
                      isStart && "rounded-l-full",
                      isEnd && "rounded-r-full",
                    )}
                  >
                    <PersonDots names={[personName]} />
                    <span className="min-w-0 truncate">{label}</span>
                  </span>
                );
              })}

              {overflow > 0 && (
                <span className="text-[8px] font-semibold text-ink-faint">
                  +{overflow} more
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {(["vacation", "holiday", "exam", "event"] as EventTag[]).map((tag) => (
          <LegendItem
            key={tag}
            className={TAG_STYLES[tag]}
            label={TAG_LABELS[tag]}
          />
        ))}
        <LegendItem className={TRAVEL_STYLE} label="Booked travel" icon />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
        Tap a day with a trip or event to edit it; tap an empty day to add a
        trip. Use &quot;+ Add an event&quot; below for anything else.
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
