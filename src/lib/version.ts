/**
 * Manually bumped alongside each release — mirrors the "vX.Y.Z: ..."
 * commit-message convention already used throughout this project's
 * history (see `git log --oneline`), just also made visible in the
 * running app itself (in the Atlas wordmark and top-right of every
 * page's Hero, see hero.tsx) so it's obvious which release is actually
 * live without checking a deploy log or git history.
 */
export const APP_VERSION = "1.1.4";
export const APP_VERSION_DATE = "2026-07-18";

/**
 * "2026-07-18" -> "18-Jul-2026" (v1.1.3) — the ISO form is right for a
 * sortable constant, but reads more like a machine timestamp than a
 * release date in the header. Parsed with an explicit UTC midnight
 * suffix, same as monthLabel()/shortMonthLabel() in lib/dates/month.ts,
 * so this can't drift a day depending on the browser's local timezone.
 */
export function formatVersionDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = date.toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}
