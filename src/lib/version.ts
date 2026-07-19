/**
 * Manually bumped alongside each release — mirrors the "vX.Y.Z: ..."
 * commit-message convention already used throughout this project's
 * history (see `git log --oneline`), just also made visible in the
 * running app itself (in the Atlas wordmark, see hero.tsx) so it's
 * obvious which release is actually live without checking a deploy
 * log or git history.
 */
export const APP_VERSION = "1.1.7";

/**
 * v1.1.6: the top-right date used to be APP_VERSION_DATE, a hardcoded
 * "release date" string bumped by hand alongside APP_VERSION — that's
 * what actually caused the "wrong timezone" report. It wasn't a
 * timezone bug in the literal sense (nothing here ever called
 * new Date() before now), it just quietly went stale: whenever a
 * release's date constant fell a day behind the real date, the header
 * looked exactly like a timezone-offset bug would. Replaced with a
 * live "today, in India" date that can't drift, computed fresh on
 * every render — Vercel's servers don't run in India's timezone, so
 * this explicitly requests Asia/Kolkata from Intl.DateTimeFormat
 * rather than relying on whatever timezone the server happens to be
 * in, which is exactly the actual, general-purpose fix for "this
 * should be as per local time i.e. India."
 */
export function getIndiaDateLabel(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).formatToParts(now);

  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  return `${day}-${month}-${year}`;
}
