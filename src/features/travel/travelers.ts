/**
 * Traveller/person color assignment (v1.1.0). Originally each traveller
 * got a color hashed out of four muted design-system tokens shared with
 * other UI (accent/positive/teal/negative) — in practice that made
 * Ahaana and Rohana nearly indistinguishable at a glance, since the
 * "Good windows for travel" cards and the Ahaana/Rohana filter chips
 * both defaulted to the same green. Known people now get a fixed,
 * bright, dedicated color each, shared consistently everywhere a name
 * appears — filter chips, the windows strip, the detailed list's person
 * pill, and trip traveller avatars — rather than being re-derived
 * per-component. Unknown/custom names (typed in on the fly when adding
 * a trip) still fall back to a deterministic hash so repeat names stay
 * consistent without needing a lookup table.
 */

const KNOWN_TRAVELERS = ["Rohit", "Ahaana", "Rohana", "Aradhana"] as const;

interface ColorClasses {
  /** Solid background, white text — avatar chips, active filter chips. */
  bg: string;
  /** Pale background, colored text — "soft" cards like the windows strip. */
  soft: string;
  /** Colored text/border on a plain surface — the detailed list's person pill. */
  text: string;
}

/** One dedicated, vibrant color per known person — deliberately not reusing accent/positive/negative/teal, which are already spoken for by the money UI and the school-event category legend (vacation/holiday/exam/travel). */
const NAMED_COLORS: Record<string, ColorClasses> = {
  Rohit: { bg: "bg-accent", soft: "bg-accent-soft", text: "text-accent" },
  Ahaana: { bg: "bg-rose", soft: "bg-rose-soft", text: "text-rose" },
  Rohana: { bg: "bg-sky", soft: "bg-sky-soft", text: "text-sky" },
  Aradhana: { bg: "bg-amber", soft: "bg-amber-soft", text: "text-amber" },
};

/** Cycled through by hash for anyone typed in who isn't one of the four known people above. */
const FALLBACK_PALETTE: ColorClasses[] = [
  { bg: "bg-positive", soft: "bg-positive-soft", text: "text-positive" },
  { bg: "bg-negative", soft: "bg-negative-soft", text: "text-negative" },
  { bg: "bg-teal", soft: "bg-teal-soft", text: "text-teal" },
  { bg: "bg-accent", soft: "bg-accent-soft", text: "text-accent" },
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function colorsFor(name: string): ColorClasses {
  return (
    NAMED_COLORS[name] ??
    FALLBACK_PALETTE[hashName(name) % FALLBACK_PALETTE.length]
  );
}

export function travelerColorClass(name: string): string {
  return colorsFor(name).bg;
}

export function travelerSoftColorClass(name: string): string {
  return colorsFor(name).soft;
}

export function travelerTextColorClass(name: string): string {
  return colorsFor(name).text;
}

/** "Rohit Kohli" -> "RO", "Ahaana" -> "AH" — a 2-letter initials badge for the avatar stack. */
export function travelerInitials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

export function knownTravelers(): readonly string[] {
  return KNOWN_TRAVELERS;
}
