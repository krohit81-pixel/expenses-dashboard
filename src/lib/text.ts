/**
 * Shortens `text` to at most `maxLength` characters, replacing the
 * cut-off tail with a single ellipsis character (so the visible result
 * never exceeds `maxLength`, ellipsis included). Used on the Travel
 * calendar grid (v1.0) to fit an event's short description into a day
 * cell without a colored dot being the only signal — see the calendar
 * page's PR notes for why dots were replaced with truncated text.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  if (maxLength <= 1) return "…".slice(0, maxLength);
  return `${text.slice(0, maxLength - 1)}…`;
}
