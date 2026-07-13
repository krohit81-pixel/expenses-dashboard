import type { Metadata } from "next";

import { Hero } from "@/components/ui/hero";

export const metadata: Metadata = {
  title: "Calendar",
};

/**
 * Public route — no password required (see src/middleware.ts's
 * PUBLIC_PATHS). Static data for now, not stored in Supabase: there's no
 * calendar/events table in the schema, and building one wasn't asked for
 * yet. Sourced from Chatrabhuj Narsee School's official AY 2026-27
 * calendar PDF, filtered to Grade 8 + whole-school dates (excludes Early
 * Years, Primary, and Grade 9/10/11/IBDP-only events). Extending this to
 * Rohana's calendar, or moving it into the database, are both real next
 * steps once there's a second data source to justify the schema work.
 */

type EventTag = "vacation" | "holiday" | "exam" | "event" | "trip";

interface CalendarEvent {
  date: string;
  day?: string;
  title: string;
  meta?: string;
  tag: EventTag;
}

interface MonthGroup {
  month: string;
  events: CalendarEvent[];
}

const TAG_STYLES: Record<EventTag, string> = {
  vacation: "bg-positive text-white",
  holiday: "bg-line text-ink-soft",
  exam: "bg-negative-soft text-negative",
  event: "bg-accent-soft text-accent",
  trip: "bg-accent-soft text-accent",
};

const TAG_LABELS: Record<EventTag, string> = {
  vacation: "Vacation",
  holiday: "Holiday",
  exam: "Exam",
  event: "Event",
  trip: "Trip",
};

const TRAVEL_WINDOWS = [
  {
    name: "Diwali Vacations",
    range: "Fri 6 Nov – Tue 17 Nov 2026",
    days: "12 days",
  },
  {
    name: "Winter Vacations",
    range: "Wed 23 Dec 2026 – Sun 3 Jan 2027",
    days: "12 days",
  },
  {
    name: "Spring Break",
    range: "Mon 22 Mar – Sun 28 Mar 2027",
    days: "7 days",
  },
  {
    name: "Summer Vacation begins",
    range: "From Fri 21 May 2027",
    days: "Open-ended",
  },
];

const CALENDAR: MonthGroup[] = [
  {
    month: "July 2026",
    events: [
      {
        date: "9",
        day: "Thu",
        title: "Secondary Orientation Grade 8 & uniform distribution",
        tag: "event",
      },
      { date: "13", day: "Mon", title: "School reopens", tag: "event" },
      {
        date: "31",
        day: "Fri",
        title: "Early exit, all students",
        tag: "event",
      },
    ],
  },
  {
    month: "August 2026",
    events: [
      {
        date: "1",
        day: "Sat",
        title: "CNS Mumbai 10th Year Celebration",
        tag: "event",
      },
      {
        date: "15",
        day: "Sat",
        title: "Independence Day + Student Council Investiture",
        tag: "holiday",
      },
      { date: "16", day: "Sun", title: "Parsi New Year", tag: "holiday" },
      {
        date: "22",
        day: "Sat",
        title: "Meet & Greet HRTs, Grades 6–10",
        tag: "event",
      },
      { date: "26", day: "Wed", title: "Eid-E-Milad", tag: "holiday" },
      { date: "27", day: "Thu", title: "School-wide holiday", tag: "holiday" },
      {
        date: "28",
        day: "Fri",
        title: "Raksha Bandhan",
        meta: "Long weekend — Fri–Sun",
        tag: "holiday",
      },
    ],
  },
  {
    month: "September 2026",
    events: [
      {
        date: "5",
        day: "Sat",
        title: "Dahi Handi / Teacher's Day",
        tag: "holiday",
      },
      {
        date: "11",
        day: "Fri",
        title: "Grandparents Day (whole school)",
        tag: "event",
      },
      { date: "14", day: "Mon", title: "Ganesh Chaturthi", tag: "holiday" },
      { date: "18", day: "Fri", title: "Gauri Pooja", tag: "holiday" },
      { date: "19", day: "Sat", title: "Gauri Visarjan", tag: "holiday" },
      { date: "25", day: "Fri", title: "Anant Chaturdashi", tag: "holiday" },
      {
        date: "30",
        day: "Wed",
        title: "Educational Trip, Grades 6–8",
        meta: "Through 4 Oct",
        tag: "trip",
      },
    ],
  },
  {
    month: "October 2026",
    events: [
      {
        date: "2",
        day: "Fri",
        title: "Mahatma Gandhi Jayanti",
        tag: "holiday",
      },
      {
        date: "9",
        day: "Fri",
        title: "Gr 8 Subject Choice presentation (for Gr 9)",
        tag: "event",
      },
      {
        date: "19",
        day: "Mon",
        title: "1st Summative Assessments, Grades 1–8",
        meta: "Through 3 Nov — avoid travel",
        tag: "exam",
      },
      { date: "20", day: "Tue", title: "Dusshera", tag: "holiday" },
    ],
  },
  {
    month: "November 2026",
    events: [
      {
        date: "4",
        day: "Wed",
        title: "Gr 8 Subject Choice form due",
        tag: "event",
      },
      {
        date: "5",
        day: "Thu",
        title: "Children's Day Celebration, picnic",
        tag: "event",
      },
      {
        date: "6–17",
        title: "Diwali Vacations",
        meta: "Fri – Tue · 12 days",
        tag: "vacation",
      },
      { date: "18", day: "Wed", title: "School reopens", tag: "event" },
      { date: "24", day: "Tue", title: "Guru Nanak Jayanti", tag: "holiday" },
    ],
  },
  {
    month: "December 2026",
    events: [
      {
        date: "5",
        day: "Sat",
        title: "Shree Chatrabhuj Narsee Jayanti · PTM Grades 7 & 8",
        tag: "event",
      },
      { date: "19", day: "Sat", title: "Secondary Sports Day", tag: "event" },
      {
        date: "22",
        day: "Tue",
        title: "Secondary Christmas Celebrations, Grades 6–10",
        tag: "event",
      },
      {
        date: "23–3",
        title: "Winter Vacations",
        meta: "Wed 23 Dec – Sun 3 Jan · 12 days",
        tag: "vacation",
      },
    ],
  },
  {
    month: "January 2027",
    events: [
      { date: "4", day: "Mon", title: "School reopens", tag: "event" },
      {
        date: "5",
        day: "Tue",
        title: "Secondary Class Photo, Grades 6–10",
        meta: "Through 7 Jan",
        tag: "event",
      },
      {
        date: "9",
        day: "Sat",
        title: "PTA Fiesta & Innovation Exhibition",
        tag: "event",
      },
      { date: "15", day: "Fri", title: "Makar Sankranti", tag: "holiday" },
      {
        date: "23",
        day: "Sat",
        title: "Quintessence V @ Mumbai",
        meta: "Through 25 Jan",
        tag: "event",
      },
      { date: "26", day: "Tue", title: "Republic Day (NID)", tag: "holiday" },
    ],
  },
  {
    month: "February 2027",
    events: [
      {
        date: "5",
        day: "Fri",
        title: "Competency Test, Additional Math — Grade 8",
        tag: "exam",
      },
      { date: "19", day: "Fri", title: "Shivaji Jayanti", tag: "holiday" },
      {
        date: "22",
        day: "Mon",
        title: "2nd Term Summative Assessment, Grade 8",
        meta: "Through 11 Mar — avoid travel",
        tag: "exam",
      },
      {
        date: "25",
        day: "Thu",
        title: "Cambridge Lower Secondary Checkpoint",
        tag: "exam",
      },
    ],
  },
  {
    month: "March 2027",
    events: [
      {
        date: "2",
        day: "Tue",
        title: "Cambridge Lower Secondary Checkpoint",
        tag: "exam",
      },
      {
        date: "4",
        day: "Thu",
        title: "Cambridge Lower Secondary Checkpoint",
        tag: "exam",
      },
      { date: "6", day: "Sat", title: "Mahashivratri", tag: "holiday" },
      { date: "10", day: "Wed", title: "Eid-ul-Fitar", tag: "holiday" },
      {
        date: "14",
        day: "Sun",
        title: "Shree Narsee Monjee Birth Anniversary",
        tag: "event",
      },
      { date: "21", day: "Sun", title: "Navroze", tag: "holiday" },
      { date: "22", day: "Mon", title: "Holi", tag: "holiday" },
      {
        date: "22–28",
        title: "Spring Break",
        meta: "Mon – Sun · 7 days · overlaps Holi",
        tag: "vacation",
      },
      { date: "26", day: "Fri", title: "Good Friday", tag: "holiday" },
      { date: "28", day: "Sun", title: "Easter Sunday", tag: "holiday" },
      { date: "29", day: "Mon", title: "School reopens", tag: "event" },
    ],
  },
  {
    month: "April 2027",
    events: [
      { date: "7", day: "Wed", title: "Gudipadwa", tag: "holiday" },
      { date: "14", day: "Wed", title: "Dr. Ambedkar Jayanti", tag: "holiday" },
    ],
  },
  {
    month: "May 2027",
    events: [
      { date: "1", day: "Sat", title: "Maharashtra Day", tag: "holiday" },
      {
        date: "5",
        day: "Wed",
        title: "Melange dress rehearsal, Grades 8 & 9",
        tag: "event",
      },
      { date: "8", day: "Sat", title: "Melange, Grades 8–9", tag: "event" },
      { date: "17", day: "Mon", title: "Eid-al-Adha", tag: "holiday" },
      {
        date: "18",
        day: "Tue",
        title: "School team tryouts",
        meta: "Through 21 May",
        tag: "event",
      },
      {
        date: "21",
        title: "Last day of school · Summer Vacation begins",
        meta: "Grades 1–11",
        tag: "vacation",
      },
    ],
  },
];

export default function CalendarPage() {
  return (
    <div>
      <Hero
        title="Calendar"
        label="Next vacation window"
        amount="Diwali · Nov 6"
        sub="12 days · AY 2026–27"
      />

      <div className="space-y-8 p-5 sm:p-8">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-accent px-3.5 py-1.5 font-display text-xs font-bold text-white">
            Ahaana &middot; Grade 8
          </span>
          <span className="rounded-full border border-dashed border-line px-3.5 py-1.5 font-display text-xs font-bold text-ink-faint">
            + Rohana
          </span>
        </div>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-[15px] font-bold text-ink">
              Good windows for travel
            </h2>
            <span className="text-xs text-ink-faint">
              {TRAVEL_WINDOWS.length} blocks
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {TRAVEL_WINDOWS.map((w) => (
              <div
                key={w.name}
                className="flex items-center justify-between gap-3 rounded-2xl bg-positive-soft px-4 py-3.5"
              >
                <div>
                  <div className="font-display text-sm font-bold text-positive">
                    {w.name}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-soft">{w.range}</div>
                </div>
                <span className="whitespace-nowrap rounded-full bg-surface px-2.5 py-1 font-display text-xs font-extrabold text-positive">
                  {w.days}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-[15px] font-bold text-ink">
              Full year · Ahaana, Grade 8
            </h2>
            <span className="text-xs text-ink-faint">
              Chatrabhuj Narsee School
            </span>
          </div>
          <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
            {CALENDAR.map((group) => (
              <div key={group.month}>
                <div className="first:pt-4.5 bg-bg px-[18px] pb-2 pt-4 font-display text-xs font-extrabold uppercase tracking-wide text-ink">
                  {group.month}
                </div>
                <ul>
                  {group.events.map((event) => (
                    <li
                      key={`${group.month}-${event.date}-${event.title}`}
                      className={`flex items-center gap-3 border-b border-line px-[18px] py-3 last:border-b-0 ${
                        event.tag === "vacation" ? "bg-positive-soft" : ""
                      }`}
                    >
                      <div className="w-11 shrink-0 text-center font-display text-[11px] font-extrabold text-ink-soft">
                        {event.date}
                        {event.day && (
                          <div className="text-[9px] font-semibold uppercase text-ink-faint">
                            {event.day}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-semibold text-ink">
                          {event.title}
                        </div>
                        {event.meta && (
                          <div className="mt-0.5 text-[11px] text-ink-faint">
                            {event.meta}
                          </div>
                        )}
                      </div>
                      <span
                        className={`shrink-0 whitespace-nowrap rounded-full px-2 py-1 font-display text-[9.5px] font-extrabold uppercase tracking-wide ${TAG_STYLES[event.tag]}`}
                      >
                        {TAG_LABELS[event.tag]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5 text-xs text-ink-soft">
            <span className="size-2.5 rounded-[3px] bg-positive" />
            Vacation — good for travel
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-soft">
            <span className="size-2.5 rounded-[3px] bg-line" />
            Holiday — single day off
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-soft">
            <span className="size-2.5 rounded-[3px] bg-negative" />
            Exam — avoid travel
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-soft">
            <span className="size-2.5 rounded-[3px] bg-accent" />
            School event
          </div>
        </div>

        <p className="text-xs leading-relaxed text-ink-faint">
          Sourced from Chatrabhuj Narsee School&apos;s official AY 2026–27
          calendar, filtered to Grade 8 and whole-school dates. This page is
          public — anyone with the link can view it, no password needed.
          Everything else in this app requires one.
        </p>
      </div>
    </div>
  );
}
