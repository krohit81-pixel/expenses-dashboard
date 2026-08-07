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
import {
  arePeopleVisible,
  type VisibilityFilter,
} from "@/features/travel/detailed-list";
import { travelerColorClass } from "@/features/travel/travelers";
import type { RecurringCalendarEvent } from "@/services/RecurringCalendarEventService";

const ROW_HEIGHT_PX = 40;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * "Rohana's week" style weekly timetable widget (v2.2.0) — the "both
 * displays" half of the /calendar brainstorm: this is the at-a-glance
 * pattern view; TripDetailedList folds the same occurrences into the
 * day-by-day list. Client-rendered against *this actual week* (not a
 * server-computed range) so it stays correct without a page reload as
 * days pass — reuses the exact same pure expandRecurringOccurrences
 * helper the server uses for the wider detailed-list range, just called
 * here with getWeekDates()'s Monday/Sunday instead.
 *
 * The hour range shown is derived from whatever's actually scheduled
 * this week (earliest start, latest end, rounded to the hour) rather
 * than a hardcoded school-day window — a general recurring-events engine
 * shouldn't assume 8am–4pm. Renders nothing at all if nothing recurring
 * is visible this week, rather than an empty grid.
 */
export function RecurringWeekGrid({
  rules,
  visible,
}: {
  rules: RecurringCalendarEvent[];
  visible: VisibilityFilter;
}) {
  const visibleRules = rules.filter((rule) =>
    arePeopleVisible(rule.people, visible),
  );
  const weekDates = getWeekDates();
  const occurrences = expandRecurringOccurrences(
    visibleRules,
    weekDates[0],
    weekDates[6],
  );

  if (occurrences.length === 0) return null;

  const startMinutes = occurrences.map((o) => minutesOfDay(o.startTime));
  const endMinutes = occurrences.map((o) => minutesOfDay(o.endTime));
  const minHour = Math.floor(Math.min(...startMinutes) / 60);
  const maxHour = Math.ceil(Math.max(...endMinutes) / 60);
  const hours = Array.from(
    { length: maxHour - minHour },
    (_, i) => minHour + i,
  );
  const gridHeight = hours.length * ROW_HEIGHT_PX;
  const today = todayISODate();

  const byDate = new Map<string, RecurringOccurrence[]>();
  for (const date of weekDates) byDate.set(date, []);
  for (const occurrence of occurrences) {
    byDate.get(occurrence.date)?.push(occurrence);
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
        <div className="flex">
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
              {byDate.get(date)?.map((occurrence) => {
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
                  <div
                    key={occurrence.key}
                    style={{ top, height }}
                    title={`${occurrence.title} · ${formatTimeRange(occurrence.startTime, occurrence.endTime)}${occurrence.mode ? ` · ${occurrence.mode}` : ""}`}
                    className={cn(
                      "absolute inset-x-[1px] overflow-hidden rounded-[6px] px-1 py-0.5 text-[8.5px] font-extrabold leading-tight text-white",
                      color,
                    )}
                  >
                    <span className="block truncate">{occurrence.title}</span>
                    <span className="block truncate text-[7.5px] font-bold opacity-85">
                      {formatTimeRange(
                        occurrence.startTime,
                        occurrence.endTime,
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
