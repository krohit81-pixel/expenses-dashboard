"use client";

import { useState } from "react";

import { SectionHeading } from "@/features/dashboard/components/SectionHeading";
import {
  formatDaysOfWeek,
  formatTimeRange,
} from "@/lib/dates/recurring-calendar-events";
import { monthLabel } from "@/lib/dates/month";
import { travelerColorClass } from "@/features/travel/travelers";
import type { RecurringCalendarEvent } from "@/services/RecurringCalendarEventService";

/** "10 Aug – 18 Sep 2026" — reuses monthLabel's month-name formatting
 * rather than a separate date formatter, just spelled out per-day. */
function formatDateRange(startDate: string, endDate: string): string {
  const fmt = (iso: string) => {
    const day = Number(iso.slice(8, 10));
    const [year, month] = [iso.slice(0, 4), iso.slice(0, 7)];
    return `${day} ${monthLabel(month).split(" ")[0]} ${year}`;
  };
  return `${fmt(startDate)} – ${fmt(endDate)}`;
}

/**
 * The rules themselves, not occurrences — a flat "what's defined right
 * now" overview, since a rule (e.g. "Calculus, Tue+Fri") isn't a single
 * date the way a trip or manual event is, so there's no one place on the
 * grid/detailed list that represents "the rule" to tap for an overview.
 * Tapping a row opens AddRecurringEventModal in edit mode — same
 * click-to-edit pattern as every other row on this page, Delete lives
 * inside that modal rather than as a separate inline action here.
 *
 * Collapsed by default (v2.3.0) — same GoodTravelWindows/TripDetailedList
 * convention, so it doesn't push the rest of the page down on a visit
 * that doesn't need it.
 */
export function RecurringEventsList({
  rules,
  onEdit,
}: {
  rules: RecurringCalendarEvent[];
  onEdit: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);

  if (rules.length === 0) return null;

  return (
    <section>
      <SectionHeading
        index="03"
        title="Recurring Events"
        meta={`${rules.length} active`}
        onClick={() => setCollapsed((c) => !c)}
        expanded={!collapsed}
      />

      {!collapsed && (
        <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          {rules.map((rule) => {
            const color =
              rule.people.length > 0
                ? travelerColorClass(rule.people[0])
                : "bg-accent";
            return (
              <button
                key={rule.id}
                type="button"
                onClick={() => onEdit(rule.id)}
                className="flex w-full items-start gap-3 border-b border-line px-[18px] py-3 text-left last:border-b-0 hover:bg-bg"
              >
                <span
                  className={`mt-1 size-2.5 shrink-0 rounded-full ${color}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-ink">
                    {rule.title}
                    {rule.mode && (
                      <span className="ml-1.5 rounded-full bg-bg px-1.5 py-0.5 align-middle font-display text-[9px] font-extrabold uppercase tracking-wide text-ink-soft">
                        {rule.mode}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-ink-soft">
                    {rule.people.length > 0
                      ? `${rule.people.join(", ")} · `
                      : ""}
                    {formatDaysOfWeek(rule.daysOfWeek)} ·{" "}
                    {formatTimeRange(rule.startTime, rule.endTime)}
                  </div>
                  <div className="mt-0.5 text-[10px] text-ink-faint">
                    {formatDateRange(rule.startDate, rule.endDate)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
