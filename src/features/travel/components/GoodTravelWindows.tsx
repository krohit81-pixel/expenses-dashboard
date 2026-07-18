"use client";

import type { PersonTravelWindow } from "@/features/travel/travel-windows";

export function GoodTravelWindows({
  windows,
  visible,
}: {
  windows: PersonTravelWindow[];
  visible: { ahaana: boolean; rohana: boolean };
}) {
  const shown = windows.filter((w) => visible[w.person]);

  return (
    <section>
      <div className="mb-3">
        <h2 className="font-display text-[15px] font-bold text-ink">
          Good windows for travel
        </h2>
        <p className="mt-0.5 text-[11.5px] text-ink-faint">
          School-free stretches worth booking around
        </p>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-5 text-center text-[12.5px] text-ink-faint">
          Turn on Ahaana or Rohana above to see their vacation windows.
        </div>
      ) : (
        <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
          {shown.map((w) => (
            <div
              key={`${w.person}-${w.name}`}
              className="min-w-[200px] shrink-0 rounded-2xl bg-positive-soft px-4 py-3.5"
            >
              <div className="font-display text-[9.5px] font-extrabold uppercase tracking-wide text-positive">
                {w.person === "ahaana" ? "Ahaana" : "Rohana"}
              </div>
              <div className="mt-0.5 font-display text-[13px] font-extrabold text-positive">
                {w.name}
              </div>
              <div className="mt-0.5 text-[11px] text-ink-soft">{w.range}</div>
              <span className="mt-1.5 inline-block rounded-full bg-surface px-2.5 py-1 font-display text-[10.5px] font-extrabold text-positive">
                {w.days}
              </span>
              {w.note && (
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-soft">
                  {w.note}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
