"use client";

import { useState } from "react";
import { CalendarPlus, Plane, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { currentMonth } from "@/lib/dates/month";
import { AddEventModal } from "@/features/calendar/components/AddEventModal";
import { GoodTravelWindows } from "@/features/travel/components/GoodTravelWindows";
import { TripCalendarGrid } from "@/features/travel/components/TripCalendarGrid";
import { TripDetailedList } from "@/features/travel/components/TripDetailedList";
import { AddTripModal } from "@/features/travel/components/AddTripModal";
import { travelerColorClass } from "@/features/travel/travelers";
import type { VisibilityFilter } from "@/features/travel/detailed-list";
import type { PersonTravelWindow } from "@/features/travel/travel-windows";
import type { SchoolCalendarItem } from "@/features/travel/school-items";
import type { CalendarEvent } from "@/services/CalendarEventService";
import type { Trip } from "@/services/TripService";

type Visibility = VisibilityFilter;

/**
 * Every named person gets the same per-person color everywhere (see
 * travelers.ts) — this chip row, the windows strip, the detailed list's
 * person pill, and any avatar for them as a trip traveller or tagged
 * event all resolve through travelerColorClass, so "Ahaana" (or
 * "Rohit") is always the same color across the whole page rather than
 * each component picking its own. Travel isn't a person, so it keeps
 * its own dedicated --teal token.
 *
 * v1.1.6: Rohit and Aradhana got their own chips here, alongside
 * Ahaana/Rohana. Unlike Ahaana/Rohana (each school item has exactly
 * one person), Rohit/Aradhana can be tagged on a trip or manual event
 * alongside other people, or not tagged at all — see
 * arePeopleVisible() in detailed-list.ts for how "hide items tagged
 * only to a hidden person, but keep untagged items visible" actually
 * works.
 */
const FILTER_CHIPS: {
  key: keyof Visibility;
  label: string;
  activeClass: string;
}[] = [
  { key: "rohit", label: "Rohit", activeClass: travelerColorClass("Rohit") },
  {
    key: "aradhana",
    label: "Aradhana",
    activeClass: travelerColorClass("Aradhana"),
  },
  { key: "ahaana", label: "Ahaana", activeClass: travelerColorClass("Ahaana") },
  { key: "rohana", label: "Rohana", activeClass: travelerColorClass("Rohana") },
  { key: "travel", label: "Travel", activeClass: "bg-teal" },
];

/**
 * Owns all interactive state for the merged Calendar + Travel tab
 * (v1.0): which grid month is showing, the Ahaana/Rohana/Travel
 * visibility filters (shared by the grid, the windows strip, and the
 * detailed list below it), and which trip (if any) the add/edit modal is
 * open for. `trips` arrives as a prop from the Calendar Server Component
 * and is used directly rather than copied into local state — after a
 * server action revalidates /calendar, Next re-renders this component
 * with a fresh `trips` prop, which is what keeps the grid/list in sync
 * after a save without a manual refetch.
 */
export function TravelCalendarSection({
  trips,
  schoolItems,
  calendarEvents,
  travelWindows,
}: {
  trips: Trip[];
  schoolItems: SchoolCalendarItem[];
  calendarEvents: CalendarEvent[];
  travelWindows: PersonTravelWindow[];
}) {
  const [month, setMonth] = useState(currentMonth());
  const [visible, setVisible] = useState<Visibility>({
    rohit: true,
    aradhana: true,
    ahaana: true,
    rohana: true,
    travel: true,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<
    string | undefined
  >();
  const [modalDefaultTab, setModalDefaultTab] = useState<"upload" | "manual">(
    "upload",
  );

  // Separate open/editing state from the trip modal above — a manual
  // event and a trip are different shapes (see AddEventModal's comment
  // on why it's its own modal rather than a mode inside AddTripModal),
  // so they need their own independent piece of "which one, if any, is
  // open" state rather than trying to share modalOpen/editingTrip.
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventModalInitialDate, setEventModalInitialDate] = useState<
    string | undefined
  >();

  function toggleFilter(key: keyof Visibility) {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openAddModal(initialDate?: string, entryTab?: "upload" | "manual") {
    setEditingTrip(null);
    setModalInitialDate(initialDate);
    setModalDefaultTab(entryTab ?? "upload");
    setModalOpen(true);
  }

  function openEditModal(tripId: string) {
    const trip = trips.find((t) => t.id === tripId);
    if (!trip) return;
    setEditingTrip(trip);
    setModalInitialDate(undefined);
    setModalOpen(true);
  }

  function openAddEventModal(initialDate?: string) {
    setEditingEvent(null);
    setEventModalInitialDate(initialDate);
    setEventModalOpen(true);
  }

  function openEditEventModal(eventId: string) {
    const event = calendarEvents.find((e) => e.id === eventId);
    if (!event) return;
    setEditingEvent(event);
    setEventModalInitialDate(undefined);
    setEventModalOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {FILTER_CHIPS.map((chip) => {
          const active = visible[chip.key];
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => toggleFilter(chip.key)}
              className={
                active
                  ? `rounded-full px-3.5 py-2 font-display text-xs font-bold text-white ${chip.activeClass}`
                  : "rounded-full border-[1.5px] border-dashed border-line px-3.5 py-2 font-display text-xs font-bold text-ink-faint"
              }
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <GoodTravelWindows windows={travelWindows} visible={visible} />

      <TripCalendarGrid
        month={month}
        onMonthChange={setMonth}
        trips={trips}
        schoolItems={schoolItems}
        calendarEvents={calendarEvents}
        visible={visible}
        onDayClick={(dateISO) => openAddModal(dateISO)}
        onTripClick={openEditModal}
        onEventClick={openEditEventModal}
      />

      <TripDetailedList
        trips={trips}
        schoolItems={schoolItems}
        calendarEvents={calendarEvents}
        visible={visible}
        onTripClick={openEditModal}
        onEventClick={openEditEventModal}
      />

      <section className="rounded-[20px] bg-surface p-5 shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-teal-soft text-teal">
            <Plane className="size-4.5" />
          </div>
          <div>
            <div className="font-display text-[14.5px] font-extrabold text-ink">
              Add a trip
            </div>
            <div className="mt-0.5 text-[11.5px] text-ink-faint">
              Upload an itinerary PDF or enter the details yourself
            </div>
          </div>
        </div>
        <p className="my-3.5 text-[11px] leading-relaxed text-ink-faint">
          Upload a flight or hotel confirmation PDF and Atlas will try to pick
          out the dates, destination and flight number automatically — you
          confirm or correct everything, then tag who&apos;s travelling, before
          it&apos;s added to the calendar above.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openAddModal()}>
            <Upload className="size-4" /> Upload itinerary (PDF)
          </Button>
          <Button
            variant="outline"
            onClick={() => openAddModal(undefined, "manual")}
          >
            + Enter manually
          </Button>
        </div>
      </section>

      <section className="rounded-[20px] bg-surface p-5 shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-accent-soft text-accent">
            <CalendarPlus className="size-4.5" />
          </div>
          <div>
            <div className="font-display text-[14.5px] font-extrabold text-ink">
              Add an event
            </div>
            <div className="mt-0.5 text-[11.5px] text-ink-faint">
              Anything else — dinner, an appointment, a reminder
            </div>
          </div>
        </div>
        <p className="my-3.5 text-[11px] leading-relaxed text-ink-faint">
          For anything that isn&apos;t a trip and isn&apos;t already on Ahaana
          or Rohana&apos;s school calendar — give it a title, tag it
          vacation/holiday/exam/event, and it shows up on the calendar above
          just like everything else.
        </p>
        <Button variant="outline" onClick={() => openAddEventModal()}>
          <CalendarPlus className="size-4" /> + Add an event
        </Button>
      </section>

      <AddTripModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingTrip={editingTrip}
        initialDate={modalInitialDate}
        defaultEntryTab={modalDefaultTab}
      />

      <AddEventModal
        open={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        editingEvent={editingEvent}
        initialDate={eventModalInitialDate}
      />
    </div>
  );
}
