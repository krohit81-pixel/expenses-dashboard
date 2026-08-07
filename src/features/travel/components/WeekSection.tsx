"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { RecurringWeekGrid } from "@/features/travel/components/RecurringWeekGrid";
import { WeekAgenda } from "@/features/travel/components/WeekAgenda";
import type { VisibilityFilter } from "@/features/travel/detailed-list";
import type { SchoolCalendarItem } from "@/features/travel/school-items";
import type { RecurringOccurrence } from "@/lib/dates/recurring-calendar-events";
import type { CalendarEvent } from "@/services/CalendarEventService";
import type { RecurringCalendarEvent } from "@/services/RecurringCalendarEventService";
import type { Trip } from "@/services/TripService";

/**
 * "This week" (v2.3.0) — the weekly timetable (RecurringWeekGrid) and
 * the day-by-day agenda (WeekAgenda) grouped under one collapsed-by-
 * default toggle, same pattern GoodTravelWindows/TripDetailedList
 * already use. Demoted below the month grid, which is now the first
 * thing shown after the filter chips — see the /calendar restructure
 * this shipped from.
 */
export function WeekSection({
  rules,
  trips,
  schoolItems,
  calendarEvents,
  recurringOccurrences,
  visible,
  onTripClick,
  onEventClick,
  onRecurringClick,
}: {
  rules: RecurringCalendarEvent[];
  trips: Trip[];
  schoolItems: SchoolCalendarItem[];
  calendarEvents: CalendarEvent[];
  recurringOccurrences: RecurringOccurrence[];
  visible: VisibilityFilter;
  onTripClick: (tripId: string) => void;
  onEventClick: (eventId: string) => void;
  onRecurringClick: (ruleId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <section>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="mb-3 flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={!collapsed}
      >
        <div>
          <h2 className="font-display text-[15px] font-bold text-ink">
            This week
          </h2>
          <p className="mt-0.5 text-[11.5px] text-ink-faint">
            The weekly timetable and a day-by-day breakdown
          </p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-ink-faint transition-transform",
            !collapsed && "rotate-180",
          )}
        />
      </button>

      {!collapsed && (
        <div className="space-y-6">
          <RecurringWeekGrid rules={rules} visible={visible} />
          <WeekAgenda
            trips={trips}
            schoolItems={schoolItems}
            calendarEvents={calendarEvents}
            recurringOccurrences={recurringOccurrences}
            visible={visible}
            onTripClick={onTripClick}
            onEventClick={onEventClick}
            onRecurringClick={onRecurringClick}
          />
        </div>
      )}
    </section>
  );
}
