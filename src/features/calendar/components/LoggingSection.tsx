"use client";

import { useState } from "react";
import {
  CalendarClock,
  CalendarPlus,
  ChevronDown,
  Plane,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** One collapsed-by-default action card — icon, title, subtitle always
 * visible; the description + actual "add" button only once expanded.
 * Local to this file rather than a shared generic component, matching
 * how GoodTravelWindows/TripDetailedList/RecurringEventsList each own
 * their collapse state rather than sharing one. */
function LogCard({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-5 text-left"
      >
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-[11px]",
            iconBg,
            iconColor,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[14.5px] font-extrabold text-ink">
            {title}
          </div>
          <div className="mt-0.5 truncate text-[11.5px] text-ink-faint">
            {subtitle}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-ink-faint transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

/**
 * "Logging" (v2.3.0) — the three add-entry-point cards (previously
 * always-expanded, always visible) grouped under one heading, each now
 * collapsed by default so this whole section reads as a short list of
 * options rather than three full cards' worth of description text
 * pushing everything below it down the page. The actual data entry
 * still happens in AddTripModal/AddEventModal/AddRecurringEventModal —
 * this only decides when each card's "here's what this does, tap to
 * add" content is visible.
 */
export function LoggingSection({
  onUploadTrip,
  onManualTrip,
  onAddEvent,
  onAddRecurring,
}: {
  onUploadTrip: () => void;
  onManualTrip: () => void;
  onAddEvent: () => void;
  onAddRecurring: () => void;
}) {
  return (
    <section>
      <h2 className="mb-3 font-display text-[15px] font-bold text-ink">
        Logging
      </h2>
      <div className="space-y-3">
        <LogCard
          icon={<Plane className="size-4.5" />}
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

        <LogCard
          icon={<CalendarPlus className="size-4.5" />}
          iconBg="bg-accent-soft"
          iconColor="text-accent"
          title="Add an event"
          subtitle="Anything else — dinner, an appointment, a reminder"
        >
          <p className="mb-3.5 text-[11px] leading-relaxed text-ink-faint">
            For anything that isn&apos;t a trip and isn&apos;t already on Ahaana
            or Rohana&apos;s school calendar — give it a title, tag it
            vacation/holiday/exam/event, and it shows up on the calendar above
            just like everything else.
          </p>
          <Button variant="outline" onClick={onAddEvent}>
            <CalendarPlus className="size-4" /> + Add an event
          </Button>
        </LogCard>

        <LogCard
          icon={<CalendarClock className="size-4.5" />}
          iconBg="bg-accent-soft"
          iconColor="text-accent"
          title="Add a recurring event"
          subtitle="Something that repeats weekly — a class, a standing appointment"
        >
          <p className="mb-3.5 text-[11px] leading-relaxed text-ink-faint">
            Pick one or more days of the week, a time, and how long it should
            run for (e.g. a semester&apos;s instructional weeks) — it shows up
            every matching week above and in the day-by-day list, and stops
            appearing on its own once it ends.
          </p>
          <Button variant="outline" onClick={onAddRecurring}>
            <CalendarClock className="size-4" /> + Add recurring event
          </Button>
        </LogCard>
      </div>
    </section>
  );
}
