"use client";

import { useState } from "react";

import {
  TAG_LABELS,
  TAG_STYLES,
  type MonthGroup,
  type TravelWindow,
} from "@/features/calendar/data";

function TravelWindows({ windows }: { windows: TravelWindow[] }) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {windows.map((w) => (
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
  );
}

function FullYearList({ calendar }: { calendar: MonthGroup[] }) {
  return (
    <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
      {calendar.map((group) => (
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
  );
}

export function CalendarPersonToggle({
  ahaanaTravelWindows,
  ahaanaCalendar,
  rohanaTravelWindows,
  rohanaCalendar,
}: {
  ahaanaTravelWindows: TravelWindow[];
  ahaanaCalendar: MonthGroup[];
  rohanaTravelWindows: TravelWindow[];
  rohanaCalendar: MonthGroup[];
}) {
  const [person, setPerson] = useState<"ahaana" | "rohana">("ahaana");

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setPerson("ahaana")}
          className={`rounded-full px-3.5 py-1.5 font-display text-xs font-bold ${
            person === "ahaana"
              ? "bg-accent text-white"
              : "border border-dashed border-line text-ink-faint"
          }`}
        >
          Ahaana &middot; Grade 8
        </button>
        <button
          onClick={() => setPerson("rohana")}
          className={`rounded-full px-3.5 py-1.5 font-display text-xs font-bold ${
            person === "rohana"
              ? "bg-accent text-white"
              : "border border-dashed border-line text-ink-faint"
          }`}
        >
          Rohana &middot; NUS
        </button>
      </div>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-[15px] font-bold text-ink">
            Good windows for travel
          </h2>
          <span className="text-xs text-ink-faint">
            {
              (person === "ahaana" ? ahaanaTravelWindows : rohanaTravelWindows)
                .length
            }{" "}
            blocks
          </span>
        </div>
        <TravelWindows
          windows={
            person === "ahaana" ? ahaanaTravelWindows : rohanaTravelWindows
          }
        />
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-[15px] font-bold text-ink">
            Full year &middot;{" "}
            {person === "ahaana" ? "Ahaana, Grade 8" : "Rohana, NUS"}
          </h2>
          <span className="text-xs text-ink-faint">
            {person === "ahaana"
              ? "Chatrabhuj Narsee School"
              : "National University of Singapore"}
          </span>
        </div>
        <FullYearList
          calendar={person === "ahaana" ? ahaanaCalendar : rohanaCalendar}
        />
      </section>
    </>
  );
}
