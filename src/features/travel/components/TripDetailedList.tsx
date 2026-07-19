"use client";

import { useState } from "react";
import { ChevronDown, Plane } from "lucide-react";

import { cn } from "@/lib/utils";
import { TAG_LABELS, TAG_STYLES } from "@/features/calendar/data";
import { dayBadge, type DayBadge } from "@/features/travel/day-badge";
import {
  buildDetailedGroups,
  type VisibilityFilter,
} from "@/features/travel/detailed-list";
import {
  travelerColorClass,
  travelerInitials,
} from "@/features/travel/travelers";
import type { SchoolCalendarItem } from "@/features/travel/school-items";
import type { CalendarEvent } from "@/services/CalendarEventService";
import type { Trip } from "@/services/TripService";

const TRAVEL_STYLE = "bg-teal-soft text-teal";
const PERSON_NAME = { ahaana: "Ahaana", rohana: "Rohana" } as const;

/** The day-number column shared by every row kind — pulled out once (v1.1.7) instead of repeating the same three-way markup at each of the three item-kind render sites below. */
function DayBadgeCell({ badge }: { badge: DayBadge }) {
  if (badge.kind === "cross-month") {
    return (
      <div className="w-11 shrink-0 pt-px text-center font-display text-[9px] font-extrabold leading-tight text-ink-soft">
        <div>{badge.startLabel}</div>
        <div className="text-[8px] font-semibold text-ink-faint">↓</div>
        <div>{badge.endLabel}</div>
      </div>
    );
  }
  return (
    <div className="w-9 shrink-0 pt-px text-center font-display text-[11px] font-extrabold text-ink-soft">
      {badge.kind === "single" ? badge.day : badge.label}
      {badge.kind === "single" && (
        <div className="text-[9px] font-semibold uppercase text-ink-faint">
          {badge.weekday}
        </div>
      )}
    </div>
  );
}

/** Same right-side avatar-circle pattern travel/manual items already use — one avatar per tagged person, most-recent-behind. Trips/manual events can have several people; a school item only ever has the one, so this is always a single circle. */
function PersonAvatars({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <div className="flex">
      {names.map((name, i) => (
        <span
          key={name}
          style={{ marginLeft: i === 0 ? 0 : -6 }}
          className={cn(
            "flex size-[19px] items-center justify-center rounded-full border-2 border-surface font-display text-[8px] font-extrabold text-white",
            travelerColorClass(name),
          )}
        >
          {travelerInitials(name)}
        </span>
      ))}
    </div>
  );
}

/**
 * Collapsed by default (v1.1.0) — this list can run to 80+ rows across a
 * full year, which meant "Add a trip" (the section right below it) was
 * always a long scroll away. Expanding is one tap; the count in the
 * header stays visible either way so collapsing doesn't hide *that*
 * there's a lot here, just the row-by-row detail.
 */
export function TripDetailedList({
  trips,
  schoolItems,
  calendarEvents,
  visible,
  onTripClick,
  onEventClick,
}: {
  trips: Trip[];
  schoolItems: SchoolCalendarItem[];
  calendarEvents: CalendarEvent[];
  visible: VisibilityFilter;
  onTripClick: (tripId: string) => void;
  onEventClick: (eventId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const groups = buildDetailedGroups(
    trips,
    schoolItems,
    visible,
    calendarEvents,
  );
  const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);

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
            Detailed calendar events
          </h2>
          <p className="mt-0.5 text-[11.5px] text-ink-faint">
            Exams, vacations, holidays and travel — chronological
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-ink-faint">{totalCount} events</span>
          <ChevronDown
            className={cn(
              "size-4 text-ink-faint transition-transform",
              !collapsed && "rotate-180",
            )}
          />
        </div>
      </button>

      {!collapsed && (
        <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          {groups.length === 0 && (
            <p className="p-6 text-center text-sm text-ink-faint">
              Nothing to show — turn on a filter above.
            </p>
          )}
          {groups.map((group) => (
            <div key={group.monthKey}>
              <div className="bg-bg px-[18px] pb-2 pt-3.5 font-display text-xs font-extrabold uppercase tracking-wide text-ink first:rounded-t-[20px]">
                {group.monthLabel}
              </div>
              <ul>
                {group.items.map((item) => {
                  const badge = dayBadge(item.startDate, item.endDate);
                  if (item.kind === "school") {
                    const personName = PERSON_NAME[item.person];
                    return (
                      <li
                        key={item.key}
                        className={cn(
                          "flex items-start gap-3 border-b border-line px-[18px] py-3 last:border-b-0",
                          item.tag === "vacation" && "bg-cal-vacation-soft",
                        )}
                      >
                        <DayBadgeCell badge={badge} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold text-ink">
                            {item.title}
                          </div>
                          {item.meta && (
                            <div className="mt-0.5 text-[11px] text-ink-faint">
                              {item.meta}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span
                            className={cn(
                              "whitespace-nowrap rounded-full px-2 py-1 font-display text-[9.5px] font-extrabold uppercase tracking-wide",
                              TAG_STYLES[item.tag],
                            )}
                          >
                            {TAG_LABELS[item.tag]}
                          </span>
                          <PersonAvatars names={[personName]} />
                        </div>
                      </li>
                    );
                  }

                  if (item.kind === "manual") {
                    return (
                      <li
                        key={item.key}
                        onClick={() => onEventClick(item.eventId)}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 border-b border-line px-[18px] py-3 last:border-b-0 hover:bg-bg",
                          item.tag === "vacation" && "bg-cal-vacation-soft",
                        )}
                      >
                        <DayBadgeCell badge={badge} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold text-ink">
                            {item.title}
                          </div>
                          {item.notes && (
                            <div className="mt-0.5 text-[11px] text-ink-faint">
                              {item.notes}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span
                            className={cn(
                              "whitespace-nowrap rounded-full px-2 py-1 font-display text-[9.5px] font-extrabold uppercase tracking-wide",
                              TAG_STYLES[item.tag],
                            )}
                          >
                            {TAG_LABELS[item.tag]}
                          </span>
                          <PersonAvatars names={item.people} />
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li
                      key={item.key}
                      onClick={() => onTripClick(item.tripId)}
                      className="flex cursor-pointer items-start gap-3 border-b border-line px-[18px] py-3 last:border-b-0 hover:bg-bg"
                    >
                      <DayBadgeCell badge={badge} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-ink">
                          {item.destination}
                        </div>
                        {item.notes && (
                          <div className="mt-0.5 text-[11px] text-ink-faint">
                            {item.notes}
                          </div>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {item.flight && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-bg px-2 py-0.5 font-display text-[10px] font-bold text-ink-soft">
                              <Plane className="size-2.5" />
                              {item.flight}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span
                          className={cn(
                            "whitespace-nowrap rounded-full px-2 py-1 font-display text-[9.5px] font-extrabold uppercase tracking-wide",
                            TRAVEL_STYLE,
                          )}
                        >
                          Travel
                        </span>
                        <PersonAvatars names={item.travelerNames} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
