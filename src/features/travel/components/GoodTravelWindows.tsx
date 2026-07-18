"use client";

import {
  travelerColorClass,
  travelerSoftColorClass,
  travelerTextColorClass,
} from "@/features/travel/travelers";
import type { PersonTravelWindow } from "@/features/travel/travel-windows";

const PERSON_NAME = { ahaana: "Ahaana", rohana: "Rohana" } as const;

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
          {shown.map((w) => {
            const name = PERSON_NAME[w.person];
            const soft = travelerSoftColorClass(name);
            const text = travelerTextColorClass(name);
            return (
              // Fixed width (not min-width) + break-words, deliberately —
              // a min-width card with no ceiling just grows to fit
              // whatever text lands in it, which is exactly what made
              // Rohana's "Summer vacation begins" note stretch this card
              // far wider than the others instead of wrapping.
              <div
                key={`${w.person}-${w.name}`}
                className={`w-[172px] shrink-0 rounded-xl px-3.5 py-3 ${soft}`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${travelerColorClass(name)}`}
                  />
                  <span
                    className={`font-display text-[9px] font-extrabold uppercase tracking-wide ${text}`}
                  >
                    {name}
                  </span>
                </div>
                <div
                  className={`mt-1 break-words font-display text-[12.5px] font-extrabold leading-snug ${text}`}
                >
                  {w.name}
                </div>
                <div className="mt-1 break-words text-[10.5px] leading-snug text-ink-soft">
                  {w.range}
                </div>
                <span
                  className={`mt-1.5 inline-block rounded-full bg-surface px-2 py-0.5 font-display text-[10px] font-extrabold ${text}`}
                >
                  {w.days}
                </span>
                {w.note && (
                  <p className="mt-1.5 break-words text-[10px] leading-relaxed text-ink-soft">
                    {w.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
