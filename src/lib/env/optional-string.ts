import { z } from "zod";

/**
 * A zod schema for an optional env var whose absence is fine, but whose
 * presence must be a real value -- v1.6.2 fix. Vercel's env var UI (and
 * some CI/shell setups) can leave a variable "set" to an empty string
 * rather than genuinely unset, e.g. if the value field was left blank
 * when the key was created. Plain `z.string().min(1).optional()` treats
 * that empty string as a *present-but-invalid* value and fails the
 * whole schema (and therefore the whole build/boot) — even though the
 * actual intent was clearly "I haven't set this yet." Blank/whitespace-
 * only collapses to undefined here first, so an accidentally-empty
 * optional var is silently treated as unset (same as if the key didn't
 * exist at all), not a hard failure over a feature that was never
 * meant to be required.
 *
 * Deliberately its own module, separate from server.ts: server.ts
 * imports "server-only", which makes it untestable directly outside a
 * real Next.js build (the package throws unconditionally without
 * Next's webpack aliasing) — same reason every other server-only
 * service in this codebase keeps its pure logic in a separate,
 * "server-only"-free module for unit testing (see e.g. donut.ts split
 * out from the Intel page, or card-category-breakdown.ts split out
 * from CreditCardIntelService.ts).
 */
export function optionalEnvString() {
  return z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().min(1).optional(),
  );
}
