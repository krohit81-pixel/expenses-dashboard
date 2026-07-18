/**
 * Traveller color assignment for the calendar grid's avatar chips
 * (v1.0). Trips store travellers as plain names (no ID, no row of their
 * own — see the trips migration), so color can't be looked up from a
 * travellers table; it's derived deterministically from the name itself,
 * meaning the same name always gets the same color across trips without
 * needing to persist a color anywhere.
 */

const KNOWN_TRAVELERS = ["Rohit", "Ahaana", "Rohana"] as const;

/** Tailwind color-token pairs (text/bg or solid bg) cycled through for travellers — same hue family as the rest of the design system, distinct enough from each other to tell two travellers' chips apart at a glance. */
const TRAVELER_PALETTE = [
  "bg-accent",
  "bg-positive",
  "bg-teal",
  "bg-negative",
] as const;

/** A short, stable hash of `name` -> a palette index, so "Ahaana" always gets the same color everywhere without a lookup table. Not cryptographic — collision resistance across a handful of first names is all this needs. */
function paletteIndexFor(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % TRAVELER_PALETTE.length;
}

export function travelerColorClass(name: string): string {
  return TRAVELER_PALETTE[paletteIndexFor(name)];
}

/** "Rohit Kohli" -> "RO", "Ahaana" -> "AH" — a 2-letter initials badge for the avatar stack, same fallback the HTML prototype used. */
export function travelerInitials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

export function knownTravelers(): readonly string[] {
  return KNOWN_TRAVELERS;
}
