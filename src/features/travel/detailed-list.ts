/**
 * Builds the merged, chronological "detailed calendar events" list for
 * the Travel-in-Calendar page (v1.0) — school events and booked trips
 * interleaved by date and grouped by month, respecting the same
 * Ahaana/Rohana/Travel visibility toggles as the month grid above it
 * (plus, since v1.1.6, Rohit/Aradhana person filters — see
 * arePeopleVisible below). Pure function so it's testable without
 * rendering anything.
 */

import { monthLabel } from "@/lib/dates/month";
import type { EventTag } from "@/features/calendar/data";
import type {
  SchoolCalendarItem,
  SchoolPerson,
} from "@/features/travel/school-items";
import type { CalendarEvent } from "@/services/CalendarEventService";
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
    }
  | {
      kind: "manual";
      key: string;
      eventId: string;
      title: string;
      tag: Exclude<EventTag, "trip">;
      people: string[];
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
  /** v1.1.6 — Rohit/Aradhana get their own filter chip, same as Ahaana/Rohana, but they can appear tagged on a trip or a manual event rather than being a fixed "kind" of item on their own. */
  rohit: boolean;
  aradhana: boolean;
}

/**
 * Rohit and Aradhana are the only two people with a dedicated filter
 * chip (see travelers.ts) — a custom name typed into a trip or event's
 * people field has no chip of its own, so it can't be hidden by one.
 */
function isPersonVisible(name: string, visible: VisibilityFilter): boolean {
  if (name === "Rohit") return visible.rohit;
  if (name === "Aradhana") return visible.aradhana;
  return true;
}

/**
 * An item with nobody tagged is never hidden by the person filters —
 * only its own dedicated toggle (Ahaana/Rohana/Travel), or nothing,
 * governs it. An item with people tagged stays visible as long as at
 * least one tagged person is currently visible, not only when every
 * tagged person is — tagging both Rohit and Aradhana on a trip and
 * then hiding just Rohit shouldn't make the trip disappear entirely.
 */
export function arePeopleVisible(
  people: string[],
  visible: VisibilityFilter,
): boolean {
  return (
    people.length === 0 || people.some((name) => isPersonVisible(name, visible))
  );
}

export function buildDetailedGroups(
  trips: Trip[],
  schoolItems: SchoolCalendarItem[],
  visible: VisibilityFilter,
  calendarEvents: CalendarEvent[] = [],
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
    ...trips
      .filter(
        (trip) =>
          visible.travel && arePeopleVisible(trip.travelerNames, visible),
      )
      .map((trip): DetailedItem => ({
        kind: "travel",
        key: `travel-${trip.id}`,
        tripId: trip.id,
        destination: trip.destination,
        flight: trip.flight,
        travelerNames: trip.travelerNames,
        notes: trip.notes,
        startDate: trip.startDate,
        endDate: trip.endDate,
      })),
    // Manual events aren't tied to Ahaana/Rohana/Travel — only the
    // Rohit/Aradhana person filters can hide one, and only if it's
    // actually tagged to a person those filters cover.
    ...calendarEvents
      .filter((event) => arePeopleVisible(event.people, visible))
      .map((event): DetailedItem => ({
        kind: "manual",
        key: `manual-${event.id}`,
        eventId: event.id,
        title: event.title,
        tag: event.tag,
        people: event.people,
        notes: event.notes,
        startDate: event.startDate,
        endDate: event.endDate,
      })),
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
