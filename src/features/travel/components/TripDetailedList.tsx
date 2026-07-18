"use client";

import { Plane } from "lucide-react";

import { cn } from "@/lib/utils";
import { TAG_LABELS, TAG_STYLES } from "@/features/calendar/data";
import {
  buildDetailedGroups,
  type VisibilityFilter,
} from "@/features/travel/detailed-list";
import {
  travelerColorClass,
  travelerInitials,
} from "@/features/travel/travelers";
import type { SchoolCalendarItem } from "@/features/travel/school-items";
import type { Trip } from "@/services/TripService";

const TRAVEL_STYLE = "bg-teal-soft text-teal";

function dayBadge(
  startDate: string,
  endDate: string,
): { big: string; small?: string } {
  const start = new Date(`${startDate}T00:00:00Z`);
  if (startDate === endDate) {
    return {
      big: String(start.getUTCDate()),
      small: start.toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: "UTC",
      }),
    };
  }
  const end = new Date(`${endDate}T00:00:00Z`);
  return { big: `${start.getUTCDate()}–${end.getUTCDate()}` };
}

export function TripDetailedList({
  trips,
  schoolItems,
  visible,
  onTripClick,
}: {
  trips: Trip[];
  schoolItems: SchoolCalendarItem[];
  visible: VisibilityFilter;
  onTripClick: (tripId: string) => void;
}) {
  const groups = buildDetailedGroups(trips, schoolItems, visible);
  const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h2 className="font-display text-[15px] font-bold text-ink">
            Detailed calendar events
          </h2>
          <p className="mt-0.5 text-[11.5px] text-ink-faint">
            Exams, vacations, holidays and travel — chronological
          </p>
        </div>
        <span className="text-xs text-ink-faint">{totalCount} events</span>
      </div>

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
                  return (
                    <li
                      key={item.key}
                      className={cn(
                        "flex items-start gap-3 border-b border-line px-[18px] py-3 last:border-b-0",
                        item.tag === "vacation" && "bg-positive-soft",
                      )}
                    >
                      <div className="w-9 shrink-0 pt-px text-center font-display text-[11px] font-extrabold text-ink-soft">
                        {badge.big}
                        {badge.small && (
                          <div className="text-[9px] font-semibold uppercase text-ink-faint">
                            {badge.small}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-ink">
                          {item.title}
                        </div>
                        {item.meta && (
                          <div className="mt-0.5 text-[11px] text-ink-faint">
                            {item.meta}
                          </div>
                        )}
                        <div className="mt-1.5">
                          <span className="rounded-full border border-line px-2 py-0.5 font-display text-[10px] font-bold text-ink-soft">
                            {item.person === "ahaana" ? "Ahaana" : "Rohana"}
                          </span>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 whitespace-nowrap rounded-full px-2 py-1 font-display text-[9.5px] font-extrabold uppercase tracking-wide",
                          TAG_STYLES[item.tag],
                        )}
                      >
                        {TAG_LABELS[item.tag]}
                      </span>
                    </li>
                  );
                }

                return (
                  <li
                    key={item.key}
                    onClick={() => onTripClick(item.tripId)}
                    className="flex cursor-pointer items-start gap-3 border-b border-line px-[18px] py-3 last:border-b-0 hover:bg-bg"
                  >
                    <div className="w-9 shrink-0 pt-px text-center font-display text-[11px] font-extrabold text-ink-soft">
                      {badge.big}
                      {badge.small && (
                        <div className="text-[9px] font-semibold uppercase text-ink-faint">
                          {badge.small}
                        </div>
                      )}
                    </div>
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
                      <div className="flex">
                        {item.travelerNames.map((name, i) => (
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
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
