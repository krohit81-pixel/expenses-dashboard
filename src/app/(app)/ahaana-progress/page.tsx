import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/require-user";
import { Hero } from "@/components/ui/hero";
import { listAhaanaActivities } from "@/services/AhaanaActivityService";
import { listAhaanaActivityLogs } from "@/services/AhaanaActivityLogService";
import {
  computeAhaanaWeeklyStats,
  buildAhaanaRecentLogEntries,
} from "@/lib/ahaana/progress-stats";
import type { AhaanaActivity } from "@/services/AhaanaActivityService";

export const metadata: Metadata = {
  title: "Ahaana's Progress",
};

const WEEKS_BACK = 6;
const RECENT_LOG_LIMIT = 12;

const CATEGORY_STYLE: Record<AhaanaActivity["category"], string> = {
  class: "bg-accent-soft text-accent",
  sport: "bg-teal-soft text-teal",
  study: "bg-amber-soft text-amber",
  other: "bg-bg text-ink-faint",
};

function weekLabel(weekStart: string): string {
  const day = Number(weekStart.slice(8, 10));
  const monthShort = new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${weekStart}T00:00:00Z`));
  return `${day} ${monthShort}`;
}

function formatDateShort(dateISO: string): string {
  const day = Number(dateISO.slice(8, 10));
  const monthShort = new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateISO}T00:00:00Z`));
  return `${day} ${monthShort}`;
}

/**
 * v3.4.0 Phase 3 — Rohit-facing read-only view of Ahaana's mini-app
 * activity: a completion-rate trend (own div-based bars, same idiom as
 * intel/page.tsx's "Month on month" chart — this codebase doesn't use
 * Recharts anywhere despite it being a listed dependency, so this page
 * doesn't introduce it either) plus her recent session notes. Lives
 * under the main `(app)` route group's existing household gate — not
 * reachable from `/ahaana` and not reachable with her password, same
 * separation the plan called for.
 */
export default async function AhaanaProgressPage() {
  await requireUser();

  const [activities, logs] = await Promise.all([
    listAhaanaActivities(),
    // A little over WEEKS_BACK weeks of history is enough for both the
    // chart (exactly WEEKS_BACK weeks) and the recent-notes list
    // (whatever's most recent within that same window) — one fetch
    // covers both rather than two separate range queries.
    listAhaanaActivityLogs(
      new Date(Date.now() - WEEKS_BACK * 7 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      new Date().toISOString().slice(0, 10),
    ),
  ]);

  const weeklyStats = computeAhaanaWeeklyStats(activities, logs, WEEKS_BACK);
  const recentEntries = buildAhaanaRecentLogEntries(
    activities,
    logs,
    RECENT_LOG_LIMIT,
  );
  const maxScheduled = Math.max(1, ...weeklyStats.map((w) => w.scheduled));

  return (
    <div>
      <Hero
        title="Ahaana's Progress"
        subtitle="What she's covered, session by session"
      />
      <div className="space-y-4 p-5 sm:p-8">
        <div className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <h2 className="mb-3 font-display text-sm font-bold text-ink">
            Weekly completion
          </h2>
          {weeklyStats.every((w) => w.scheduled === 0) ? (
            <p className="text-xs text-ink-faint">
              No activities scheduled yet — add one from Ahaana&rsquo;s own
              &ldquo;Manage&rdquo; screen to start tracking.
            </p>
          ) : (
            <>
              <div className="flex h-[130px] items-end gap-2.5">
                {weeklyStats.map((w) => {
                  const heightPct = Math.max(
                    4,
                    (w.scheduled / maxScheduled) * 100,
                  );
                  const completedPct =
                    w.scheduled === 0 ? 0 : (w.completed / w.scheduled) * 100;
                  return (
                    <div
                      key={w.weekStart}
                      className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                    >
                      <span className="font-display text-[10px] font-semibold text-ink-faint">
                        {w.completionRate}%
                      </span>
                      <div
                        className="relative w-3/5 overflow-hidden rounded-t-lg bg-accent-soft"
                        style={{ height: `${heightPct}%` }}
                      >
                        <div
                          className="absolute inset-x-0 bottom-0 bg-accent"
                          style={{ height: `${completedPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2.5 border-t border-line pt-2">
                {weeklyStats.map((w) => (
                  <span
                    key={w.weekStart}
                    className="flex-1 text-center font-display text-[10px] font-semibold text-ink-faint"
                  >
                    {weekLabel(w.weekStart)}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-ink-faint">
                Completed sessions vs. scheduled, per week (Mon–Sun).
              </p>
            </>
          )}
        </div>

        <div className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <h2 className="mb-3 font-display text-sm font-bold text-ink">
            Recent notes
          </h2>
          {recentEntries.length === 0 ? (
            <p className="text-xs text-ink-faint">
              Nothing logged yet — once Ahaana marks a session complete with
              notes, it shows up here.
            </p>
          ) : (
            <ul className="space-y-3">
              {recentEntries.map((entry) => (
                <li
                  key={`${entry.activityId}-${entry.date}`}
                  className="rounded-[16px] border border-line p-3.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 font-display text-[9.5px] font-extrabold uppercase tracking-wide ${CATEGORY_STYLE[entry.category]}`}
                    >
                      {entry.category}
                    </span>
                    <span className="font-display text-[13.5px] font-bold text-ink">
                      {entry.title}
                    </span>
                    <span className="ml-auto text-[11px] text-ink-faint">
                      {formatDateShort(entry.date)}
                    </span>
                  </div>
                  {entry.coveredNotes && (
                    <p className="mt-1.5 text-[12.5px] text-ink">
                      {entry.coveredNotes}
                    </p>
                  )}
                  {entry.nextNotes && (
                    <p className="mt-1 text-[12px] text-ink-faint">
                      → Next: {entry.nextNotes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
