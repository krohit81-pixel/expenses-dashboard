"use client";

import { useState } from "react";

import { CalendarPlus } from "lucide-react";

import { currentMonth } from "@/lib/dates/month";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/features/dashboard/components/SectionHeading";
import { AddEventModal } from "@/features/calendar/components/AddEventModal";
import { AddRecurringEventModal } from "@/features/calendar/components/AddRecurringEventModal";
import { LoggingSection } from "@/features/calendar/components/LoggingSection";
import { RecurringEventsList } from "@/features/calendar/components/RecurringEventsList";
import { GoodTravelWindows } from "@/features/travel/components/GoodTravelWindows";
import { TripCalendarGrid } from "@/features/travel/components/TripCalendarGrid";
import { TripDetailedList } from "@/features/travel/components/TripDetailedList";
import { WeekScheduleGrid } from "@/features/travel/components/WeekScheduleGrid";
import { AddTripModal } from "@/features/travel/components/AddTripModal";
import { travelerColorClass } from "@/features/travel/travelers";
import type { VisibilityFilter } from "@/features/travel/detailed-list";
import type { PersonTravelWindow } from "@/features/travel/travel-windows";
import type { SchoolCalendarItem } from "@/features/travel/school-items";
import type { RecurringOccurrence } from "@/lib/dates/recurring-calendar-events";
import type { CalendarEvent } from "@/services/CalendarEventService";
import type { RecurringCalendarEvent } from "@/services/RecurringCalendarEventService";
import type { Trip } from "@/services/TripService";

type Visibility = VisibilityFilter;
type SectionTab = "dashboard" | "report" | "log";

/**
 * v3.3.0 — Log moved from last to the middle (was Summary/Details/Log,
 * household request) and reads visually bigger than its two siblings
 * in the switcher below — it's the tab that actually gets tapped most
 * (adding something), not just a place to review data like the other
 * two.
 */
const SECTION_TABS: { key: SectionTab; label: string }[] = [
  { key: "dashboard", label: "Summary" },
  { key: "log", label: "Log" },
  { key: "report", label: "Details" },
];

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
 * visibility filters (shared by every section below), and which trip
 * (if any) the add/edit modal is open for. `trips` arrives as a prop
 * from the Calendar Server Component and is used directly rather than
 * copied into local state — after a server action revalidates
 * /calendar, Next re-renders this component with a fresh `trips` prop,
 * which is what keeps everything in sync after a save without a manual
 * refetch.
 *
 * v2.4.0: the page is now three switchable sections — Dashboard (month
 * grid + this week's schedule, always expanded), Report (good windows
 * for travel, detailed calendar events, recurring events — each still
 * individually collapsed), and Log (the three add cards) — behind a
 * pill tab switcher below the person filter chips, which stay visible
 * across all three since they affect every section's content. Replaces
 * the earlier "one long collapsed-by-default scroll" layout from
 * v2.3.0.
 *
 * v2.5.0: DayViewModal (a full-screen Outlook-style day view) is gone —
 * both TripCalendarGrid and WeekScheduleGrid now expand DayDetailCard
 * inline, right below whichever day/week row was tapped, so there's no
 * modal state to own here anymore. WeekScheduleGrid also stopped being
 * pinned to the current week; it owns its own week-offset state and
 * pages independently.
 */
export function TravelCalendarSection({
  trips,
  schoolItems,
  calendarEvents,
  recurringRules,
  recurringOccurrences,
  travelWindows,
  isLoggedIn,
}: {
  trips: Trip[];
  schoolItems: SchoolCalendarItem[];
  calendarEvents: CalendarEvent[];
  recurringRules: RecurringCalendarEvent[];
  recurringOccurrences: RecurringOccurrence[];
  travelWindows: PersonTravelWindow[];
  /** v3.4.13 — forwarded straight to AddEventModal's "Send reminder now" button; see CalendarPage's own comment for where this comes from. */
  isLoggedIn: boolean;
}) {
  const [month, setMonth] = useState(currentMonth());
  const [visible, setVisible] = useState<Visibility>({
    rohit: true,
    aradhana: true,
    ahaana: true,
    rohana: true,
    travel: true,
  });
  const [activeTab, setActiveTab] = useState<SectionTab>("dashboard");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
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

  // A recurring rule isn't a single date the way a trip/manual event is
  // (see RecurringEventsList's comment), so it gets its own independent
  // open/editing state too, same reasoning as eventModalOpen above.
  const [recurringModalOpen, setRecurringModalOpen] = useState(false);
  const [editingRecurringRule, setEditingRecurringRule] =
    useState<RecurringCalendarEvent | null>(null);

  function toggleFilter(key: keyof Visibility) {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openAddModal(entryTab?: "upload" | "manual") {
    setEditingTrip(null);
    setModalDefaultTab(entryTab ?? "upload");
    setModalOpen(true);
  }

  function openEditModal(tripId: string) {
    const trip = trips.find((t) => t.id === tripId);
    if (!trip) return;
    setEditingTrip(trip);
    setModalOpen(true);
  }

  function openAddEventModal() {
    setEditingEvent(null);
    setEventModalOpen(true);
  }

  function openEditEventModal(eventId: string) {
    const event = calendarEvents.find((e) => e.id === eventId);
    if (!event) return;
    setEditingEvent(event);
    setEventModalOpen(true);
  }

  function openEditRecurringModal(ruleId: string) {
    const rule = recurringRules.find((r) => r.id === ruleId);
    if (!rule) return;
    setEditingRecurringRule(rule);
    setRecurringModalOpen(true);
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

      {/* v2.5.2: was bg-ink/text-bg (a near-black pill in light mode) —
          switched to bg-accent/text-white, the same selection color
          used for the selected day ring elsewhere on this page, so
          "selected" reads consistently rather than defaulting to black
          here specifically.

          v3.3.0: Log gets more flex-grow and a bigger label than
          Summary/Details (flex-[1.4] + text-[13.5px] vs flex-1 +
          text-[12.5px]) — "make the log little big," since it's the
          tab people actually tap to do something, not just review. */}
      <div className="flex gap-1 rounded-full bg-line p-1">
        {SECTION_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "rounded-full py-2 text-center font-display font-bold transition-colors",
              tab.key === "log"
                ? "flex-[1.4] text-[13.5px]"
                : "flex-1 text-[12.5px]",
              activeTab === tab.key ? "bg-accent text-white" : "text-ink-soft",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "dashboard" && (
        <div className="space-y-6">
          <section>
            <SectionHeading index="01" title="Monthly Schedule" />
            <TripCalendarGrid
              month={month}
              onMonthChange={setMonth}
              trips={trips}
              schoolItems={schoolItems}
              calendarEvents={calendarEvents}
              recurringOccurrences={recurringOccurrences}
              visible={visible}
              onTripClick={openEditModal}
              onEventClick={openEditEventModal}
              onRecurringClick={openEditRecurringModal}
            />
          </section>

          <WeekScheduleGrid
            rules={recurringRules}
            trips={trips}
            schoolItems={schoolItems}
            calendarEvents={calendarEvents}
            visible={visible}
            onTripClick={openEditModal}
            onEventClick={openEditEventModal}
            onRecurringClick={openEditRecurringModal}
          />

          {/* v3.3.1 — a quick-access "Add event" entry point right on
              Summary (household request), so adding something doesn't
              require switching to Log first. Same openAddEventModal
              state/handler Log's own "Add an event" card already uses —
              this is just a second door into the identical modal, not a
              separate flow. */}
          <section>
            <SectionHeading index="03" title="Add Event" />
            <button
              type="button"
              onClick={openAddEventModal}
              className="flex w-full items-center gap-3 rounded-[20px] bg-surface p-5 text-left shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-accent-soft text-accent">
                <CalendarPlus className="size-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[14.5px] font-extrabold text-ink">
                  Add an event
                </div>
                <div className="mt-0.5 text-[11.5px] text-ink-faint">
                  Dinner, an appointment, a class that repeats
                </div>
              </div>
              <span className="shrink-0 font-display text-xs font-bold text-accent">
                + Add
              </span>
            </button>
          </section>
        </div>
      )}

      {activeTab === "report" && (
        <div className="space-y-6">
          <GoodTravelWindows windows={travelWindows} visible={visible} />

          <TripDetailedList
            trips={trips}
            schoolItems={schoolItems}
            calendarEvents={calendarEvents}
            recurringOccurrences={recurringOccurrences}
            visible={visible}
            onTripClick={openEditModal}
            onEventClick={openEditEventModal}
            onRecurringClick={openEditRecurringModal}
          />

          <RecurringEventsList
            rules={recurringRules}
            onEdit={openEditRecurringModal}
          />
        </div>
      )}

      {activeTab === "log" && (
        <LoggingSection
          onUploadTrip={() => openAddModal("upload")}
          onManualTrip={() => openAddModal("manual")}
          onAddEvent={openAddEventModal}
        />
      )}

      <AddTripModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingTrip={editingTrip}
        defaultEntryTab={modalDefaultTab}
      />

      <AddEventModal
        open={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        editingEvent={editingEvent}
        isLoggedIn={isLoggedIn}
      />

      <AddRecurringEventModal
        open={recurringModalOpen}
        onClose={() => setRecurringModalOpen(false)}
        editingRule={editingRecurringRule}
      />
    </div>
  );
}
