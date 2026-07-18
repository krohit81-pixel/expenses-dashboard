"use client";

import { useState } from "react";
import { Plane, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { currentMonth } from "@/lib/dates/month";
import { GoodTravelWindows } from "@/features/travel/components/GoodTravelWindows";
import { TripCalendarGrid } from "@/features/travel/components/TripCalendarGrid";
import { TripDetailedList } from "@/features/travel/components/TripDetailedList";
import { AddTripModal } from "@/features/travel/components/AddTripModal";
import type { PersonTravelWindow } from "@/features/travel/travel-windows";
import type { SchoolCalendarItem } from "@/features/travel/school-items";
import type { Trip } from "@/services/TripService";

type Visibility = { ahaana: boolean; rohana: boolean; travel: boolean };

const FILTER_CHIPS: {
  key: keyof Visibility;
  label: string;
  activeClass: string;
}[] = [
  { key: "ahaana", label: "Ahaana", activeClass: "bg-positive" },
  { key: "rohana", label: "Rohana", activeClass: "bg-positive" },
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
  travelWindows,
}: {
  trips: Trip[];
  schoolItems: SchoolCalendarItem[];
  travelWindows: PersonTravelWindow[];
}) {
  const [month, setMonth] = useState(currentMonth());
  const [visible, setVisible] = useState<Visibility>({
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
        visible={visible}
        onDayClick={(dateISO) => openAddModal(dateISO)}
        onTripClick={openEditModal}
      />

      <TripDetailedList
        trips={trips}
        schoolItems={schoolItems}
        visible={visible}
        onTripClick={openEditModal}
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

      <AddTripModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingTrip={editingTrip}
        initialDate={modalInitialDate}
        defaultEntryTab={modalDefaultTab}
      />
    </div>
  );
}
