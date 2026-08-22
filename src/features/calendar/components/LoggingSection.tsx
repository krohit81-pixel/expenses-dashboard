"use client";

import { useState } from "react";
import { CalendarPlus, ChevronDown, Plane, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/features/dashboard/components/SectionHeading";

/** One collapsed-by-default action card — icon, title, subtitle always
 * visible; the description + actual "add" button only once expanded.
 * Local to this file rather than a shared generic component, matching
 * how GoodTravelWindows/TripDetailedList/RecurringEventsList each own
 * their collapse state rather than sharing one.
 *
 * v3.3.0 — sized up a notch (bigger icon tile, more padding, a larger
 * title) as part of making Log read as the primary action tab it's
 * meant to be, now that it sits front-and-center between Summary and
 * Details in the tab order rather than trailing behind Details. */
function LogCard({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  defaultOpen,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className="rounded-[22px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3.5 p-5 text-left sm:p-6"
      >
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-[13px]",
            iconBg,
            iconColor,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[16px] font-extrabold text-ink">
            {title}
          </div>
          <div className="mt-0.5 truncate text-[12px] text-ink-faint">
            {subtitle}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "size-4.5 shrink-0 text-ink-faint transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && <div className="px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>}
    </div>
  );
}

/**
 * "Logging" (v2.3.0) — the add-entry-point cards grouped under one
 * heading, each collapsed by default so this whole section reads as a
 * short list of options rather than full cards' worth of description
 * text pushing everything below it down the page. The actual data
 * entry still happens in AddTripModal/AddEventModal — this only
 * decides when each card's "here's what this does, tap to add" content
 * is visible.
 *
 * v3.3.0: two changes, both by request. Event moved above Trip (was
 * Trip/Event/Recurring) — event logging is the more common action, so
 * it's now the first thing offered, opened by default rather than
 * collapsed. The standalone "Add a recurring event" card is gone
 * entirely: AddEventModal itself gained a "Repeats weekly" toggle
 * (household: "allow to make the event as recurring between the event
 * dialogue box, no need to add a separate section"), so there's no
 * second entry point left to offer here — see AddEventModal's own
 * comment for how that toggle works. onAddRecurring is gone from this
 * component's props for the same reason; TravelCalendarSection still
 * keeps its own recurring-modal state for EDITING an existing rule
 * (tapped from the grid/week view/Recurring events list), unaffected
 * by this.
 */
export function LoggingSection({
  onUploadTrip,
  onManualTrip,
  onAddEvent,
}: {
  onUploadTrip: () => void;
  onManualTrip: () => void;
  onAddEvent: () => void;
}) {
  return (
    <section>
      <SectionHeading index="01" title="Add Something New" />
      <div className="space-y-3">
        <LogCard
          icon={<CalendarPlus className="size-5" />}
          iconBg="bg-accent-soft"
          iconColor="text-accent"
          title="Add an event"
          subtitle="Anything else — dinner, an appointment, a class that repeats"
          defaultOpen
        >
          <p className="mb-3.5 text-[11px] leading-relaxed text-ink-faint">
            For anything that isn&apos;t a trip and isn&apos;t already on Ahaana
            or Rohana&apos;s school calendar — give it a title, tag it
            vacation/holiday/exam/event, and it shows up on the calendar above
            just like everything else. Repeats weekly (a class, a standing
            appointment)? Toggle &ldquo;Repeats weekly&rdquo; right inside the
            same form — no separate flow needed.
          </p>
          <Button onClick={onAddEvent}>
            <CalendarPlus className="size-4" /> + Add an event
          </Button>
        </LogCard>

        <LogCard
          icon={<Plane className="size-5" />}
          iconBg="bg-teal-soft"
          iconColor="text-teal"
          title="Add a trip"
          subtitle="Upload an itinerary PDF or enter the details yourself"
        >
          <p className="mb-3.5 text-[11px] leading-relaxed text-ink-faint">
            Upload a flight or hotel confirmation PDF and Atlas will try to pick
            out the dates, destination and flight number automatically — you
            confirm or correct everything, then tag who&apos;s travelling,
            before it&apos;s added to the calendar above.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onUploadTrip}>
              <Upload className="size-4" /> Upload itinerary (PDF)
            </Button>
            <Button variant="outline" onClick={onManualTrip}>
              + Enter manually
            </Button>
          </div>
        </LogCard>
      </div>
    </section>
  );
}
