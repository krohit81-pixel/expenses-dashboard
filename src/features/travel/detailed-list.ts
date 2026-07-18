/**
 * Builds the merged, chronological "detailed calendar events" list for
 * the Travel-in-Calendar page (v1.0) — school events and booked trips
 * interleaved by date and grouped by month, respecting the same
 * Ahaana/Rohana/Travel visibility toggles as the month grid above it.
 * Pure function so it's testable without rendering anything.
 */

import { monthLabel } from "@/lib/dates/month";
import type { EventTag } from "@/features/calendar/data";
import type {
  SchoolCalendarItem,
  SchoolPerson,
} from "@/features/travel/school-items";
import type { Trip } from "@/services/TripService";

export type DetailedItem =
  | {
      kind: "school";
      key: string;
      person: SchoolPerson;
      title: string;
      meta?: string;
      tag: EventTag;
      startDate: string;
      endDate: string;
    }
  | {
      kind: "travel";
      key: string;
      tripId: string;
      destination: string;
      flight: string | null;
      travelerNames: string[];
      notes: string | null;
      startDate: string;
      endDate: string;
    };

export interface DetailedGroup {
  monthKey: string;
  monthLabel: string;
  items: DetailedItem[];
}

export interface VisibilityFilter {
  ahaana: boolean;
  rohana: boolean;
  travel: boolean;
}

export function buildDetailedGroups(
  trips: Trip[],
  schoolItems: SchoolCalendarItem[],
  visible: VisibilityFilter,
): DetailedGroup[] {
  const items: DetailedItem[] = [
    ...schoolItems
      .filter((item) => visible[item.person])
      .map((item): DetailedItem => ({
        kind: "school",
        key: `school-${item.person}-${item.title}-${item.startDate}`,
        person: item.person,
        title: item.title,
        meta: item.meta,
        tag: item.tag,
        startDate: item.startDate,
        endDate: item.endDate,
      })),
    ...(visible.travel
      ? trips.map((trip): DetailedItem => ({
          kind: "travel",
          key: `travel-${trip.id}`,
          tripId: trip.id,
          destination: trip.destination,
          flight: trip.flight,
          travelerNames: trip.travelerNames,
          notes: trip.notes,
          startDate: trip.startDate,
          endDate: trip.endDate,
        }))
      : []),
  ];

  items.sort(
    (a, b) =>
      a.startDate.localeCompare(b.startDate) || a.key.localeCompare(b.key),
  );

  const groups = new Map<string, DetailedGroup>();
  for (const item of items) {
    const monthKey = item.startDate.slice(0, 7);
    let group = groups.get(monthKey);
    if (!group) {
      group = { monthKey, monthLabel: monthLabel(monthKey), items: [] };
      groups.set(monthKey, group);
    }
    group.items.push(item);
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey),
  );
}
