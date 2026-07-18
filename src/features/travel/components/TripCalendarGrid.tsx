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
import type { SchoolCalendarItem } from "@/features/travel/school-items";
import type { Trip } from "@/services/TripService";

const TRAVEL_STYLE = "bg-teal text-white";
const MAX_CHIPS_PER_DAY = 3;

type Chip =
  | { kind: "school"; key: string; item: SchoolCalendarItem }
  | { kind: "trip"; key: string; trip: Trip };

function chipsForDate(
  dateISO: string,
  trips: Trip[],
  schoolItems: SchoolCalendarItem[],
  visible: { ahaana: boolean; rohana: boolean; travel: boolean },
): Chip[] {
  const chips: Chip[] = [];

  if (visible.travel) {
    for (const trip of trips) {
      if (dateISO >= trip.startDate && dateISO <= trip.endDate) {
        chips.push({ kind: "trip", key: `trip-${trip.id}`, trip });
      }
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
  return chips;
}

export function TripCalendarGrid({
  month,
  onMonthChange,
  trips,
  schoolItems,
  visible,
  onDayClick,
  onTripClick,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  trips: Trip[];
  schoolItems: SchoolCalendarItem[];
  visible: { ahaana: boolean; rohana: boolean; travel: boolean };
  onDayClick: (dateISO: string) => void;
  onTripClick: (tripId: string) => void;
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
          const chips = chipsForDate(dateISO, trips, schoolItems, visible);
          const shown = chips.slice(0, MAX_CHIPS_PER_DAY);
          const overflow = chips.length - shown.length;
          const dayNumber = Number(dateISO.slice(8, 10));

          return (
            <button
              type="button"
              key={dateISO}
              onClick={() => {
                const tripHere = shown.find(
                  (c): c is Extract<Chip, { kind: "trip" }> =>
                    c.kind === "trip",
                );
                if (tripHere) onTripClick(tripHere.trip.id);
                else onDayClick(dateISO);
              }}
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
                if (chip.kind === "trip") {
                  const isStart = dateISO === chip.trip.startDate;
                  const isEnd = dateISO === chip.trip.endDate;
                  const label = truncate(
                    `${chip.trip.destination}${chip.trip.flight ? ` · ${chip.trip.flight}` : ""}`,
                    15,
                  );
                  return (
                    <span
                      key={chip.key}
                      title={`${chip.trip.destination}${chip.trip.flight ? ` · ${chip.trip.flight}` : ""}`}
                      className={cn(
                        "truncate rounded px-1 py-[1.5px] font-display text-[9px] font-bold",
                        TRAVEL_STYLE,
                        isStart && "rounded-l-full",
                        isEnd && "rounded-r-full",
                      )}
                    >
                      {isStart ? label : " "}
                    </span>
                  );
                }

                const isStart = dateISO === chip.item.startDate;
                const isEnd = dateISO === chip.item.endDate;
                const label = truncate(chip.item.title, 15);
                return (
                  <span
                    key={chip.key}
                    title={`${chip.item.title} (${chip.item.person === "ahaana" ? "Ahaana" : "Rohana"})`}
                    className={cn(
                      "truncate rounded px-1 py-[1.5px] font-display text-[9px] font-bold",
                      TAG_STYLES[chip.item.tag],
                      isStart && "rounded-l-full",
                      isEnd && "rounded-r-full",
                    )}
                  >
                    {isStart ? label : " "}
                  </span>
                );
              })}

              {overflow > 0 && (
                <span className="text-[8px] font-semibold text-ink-faint">
                  +{overflow} more
                </span>
              )}
            </button>
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
        Tap a day with a trip to edit it; tap an empty day to add one.
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
