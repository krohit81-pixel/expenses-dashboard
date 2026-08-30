"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { SectionHeading } from "@/features/dashboard/components/SectionHeading";
import {
  getWeekDates,
  shiftDate,
  todayISODate,
} from "@/lib/dates/calendar-grid";
import { expandRecurringOccurrences } from "@/lib/dates/recurring-calendar-events";
import {
  compactChipsForDate,
  type DisplayChip,
} from "@/features/travel/components/TripCalendarGrid";
import { ChipBadge } from "@/features/travel/components/ChipBadge";
import { DayDetailCard } from "@/features/travel/components/DayDetailCard";
import {
  arePeopleVisible,
  type VisibilityFilter,
} from "@/features/travel/detailed-list";
import type { SchoolCalendarItem } from "@/features/travel/school-items";
import type { CalendarEvent } from "@/services/CalendarEventService";
import type { RecurringCalendarEvent } from "@/services/RecurringCalendarEventService";
import type { Trip } from "@/services/TripService";

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/**
 * "This week's schedule" (v2.5.0) — rebuilt as a day-list matching the
 * month/week-view prototype: each day is a row (weekday + number on the
 * left), its items as wrapped "bold top bar" chips (ChipBadge) on the
 * right, tapping a row expands the same DayDetailCard the month grid
 * uses right below it. Replaces the earlier hourly-timeline + all-day-
 * band layout entirely — that version couldn't move off the current
 * week, which is the one thing this rebuild specifically adds: `weekOffset`
 * shifts the whole 7-day window by ±7 days per tap, with a "This week"
 * button to jump back once you've navigated away.
 *
 * Recurring occurrences are expanded here client-side against whichever
 * week is showing (not the server-computed range in props) so paging
 * through weeks doesn't depend on the server range happening to cover
 * them — same reasoning the pre-v2.5.0 version had for the current week
 * specifically, just generalized to any week now.
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
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const today = todayISODate();
  const referenceDate = shiftDate(today, weekOffset * 7);
  const weekDates = getWeekDates(referenceDate);

  const visibleRules = rules.filter((rule) =>
    arePeopleVisible(rule.people, visible),
  );
  const occurrences = expandRecurringOccurrences(
    visibleRules,
    weekDates[0],
    weekDates[6],
  );

  function goToWeek(delta: number) {
    setWeekOffset((w) => w + delta);
    setSelectedDate(null);
  }
  function goToThisWeek() {
    setWeekOffset(0);
    setSelectedDate(null);
  }

  const rangeLabel = `${weekDates[0].slice(8, 10)}–${weekDates[6].slice(8, 10)} ${new Date(
    `${weekDates[6]}T00:00:00Z`,
  ).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}`;

  return (
    <section>
      <SectionHeading
        // v3.6.3 — was "02"; BusiestWeekCard became the Summary tab's
        // new 01 (TravelCalendarSection.tsx), pushing Monthly Schedule
        // to 02 and this to 03.
        index="03"
        title="This Week's Schedule"
        meta={rangeLabel}
        right={
          <div className="flex items-center gap-1.5">
            {weekOffset !== 0 && (
              <button
                type="button"
                onClick={goToThisWeek}
                className="rounded-full px-2.5 py-1.5 font-display text-[10.5px] font-bold text-accent"
              >
                This week
              </button>
            )}
            <button
              type="button"
              aria-label="Previous week"
              onClick={() => goToWeek(-1)}
              className="flex size-8 items-center justify-center rounded-full border border-line text-ink-soft hover:bg-bg"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next week"
              onClick={() => goToWeek(1)}
              className="flex size-8 items-center justify-center rounded-full border border-line text-ink-soft hover:bg-bg"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        }
      />

      <div className="rounded-[20px] bg-surface p-3.5 shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
        <div className="space-y-[3px]">
          {weekDates.map((date, i) => {
            const chips: DisplayChip[] = compactChipsForDate(
              date,
              trips,
              schoolItems,
              calendarEvents,
              occurrences,
              visible,
            );
            const isToday = date === today;
            return (
              <div key={date}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setSelectedDate((d) => (d === date ? null : date))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedDate((d) => (d === date ? null : date));
                    }
                  }}
                  className={cn(
                    "flex items-start gap-2.5 rounded-[14px] p-2.5 text-left transition-colors",
                    date === selectedDate
                      ? "bg-accent-soft ring-1 ring-inset ring-accent/50"
                      : "bg-bg",
                  )}
                >
                  <div className="w-9 shrink-0 pt-0.5 text-center">
                    <div
                      className={cn(
                        "font-display text-[8.5px] font-extrabold uppercase tracking-wide",
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
                  <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                    {chips.length === 0 ? (
                      <p className="pt-1.5 text-[11px] text-ink-faint">
                        Nothing scheduled
                      </p>
                    ) : (
                      chips.map((chip) => (
                        <ChipBadge
                          key={chip.key}
                          label={chip.label}
                          barColorClass={chip.barColorClass}
                          size="lg"
                        />
                      ))
                    )}
                  </div>
                </div>
                {date === selectedDate && (
                  <DayDetailCard
                    date={date}
                    trips={trips}
                    schoolItems={schoolItems}
                    calendarEvents={calendarEvents}
                    recurringOccurrences={occurrences}
                    visible={visible}
                    onTripClick={onTripClick}
                    onEventClick={onEventClick}
                    onRecurringClick={onRecurringClick}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
