/**
 * Best-effort extraction of destination/dates/flight from a PDF
 * itinerary's raw text (v1.0, client-side parsing per the "keep it
 * simple, no new backend cost" decision — see AddTripModal, which runs
 * pdf.js in the browser to produce the text this function takes).
 *
 * Deliberately heuristic, not a real itinerary parser: airline PDFs have
 * no consistent layout, so this looks for common patterns (a flight code,
 * any recognizable date, a "Destination:"-style label or an airport-code
 * route) and returns whatever it finds — every field is nullable and the
 * caller always shows the result as an editable, reviewable form rather
 * than trusting it outright.
 */

import { MONTH_INDEX } from "@/lib/dates/school-calendar";

export interface ParsedItinerary {
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  flight: string | null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function toISO(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function extractFlight(text: string): string | null {
  // A typical IATA-style flight code: a 2-character airline code (two
  // letters, or one letter + one digit, e.g. "6E") followed by a 2-4
  // digit flight number. Takes the first match only — good enough for a
  // single-flight confirmation, which is the common case this targets.
  const match = text.match(
    /\b([A-Z]{2}|[0-9][A-Z]|[A-Z][0-9])\s?-?\s?(\d{2,4})\b/,
  );
  return match ? `${match[1]} ${match[2]}` : null;
}

function extractDateRange(text: string): {
  startDate: string | null;
  endDate: string | null;
} {
  const found: Date[] = [];

  const reDayMonthYear =
    /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})\b/gi;
  const reMonthDayYear =
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/gi;
  const reIsoDate = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  const reSlashDate = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;

  for (const m of text.matchAll(reDayMonthYear)) {
    const monthIndex = MONTH_INDEX[m[2].slice(0, 3).toLowerCase()];
    if (monthIndex !== undefined)
      found.push(new Date(Date.UTC(+m[3], monthIndex, +m[1])));
  }
  for (const m of text.matchAll(reMonthDayYear)) {
    const monthIndex = MONTH_INDEX[m[1].slice(0, 3).toLowerCase()];
    if (monthIndex !== undefined)
      found.push(new Date(Date.UTC(+m[3], monthIndex, +m[2])));
  }
  for (const m of text.matchAll(reIsoDate)) {
    found.push(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])));
  }
  for (const m of text.matchAll(reSlashDate)) {
    found.push(new Date(Date.UTC(+m[3], +m[1] - 1, +m[2])));
  }

  const valid = found
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (valid.length === 0) return { startDate: null, endDate: null };
  return {
    startDate: toISO(valid[0]),
    endDate: toISO(valid[valid.length - 1]),
  };
}

function extractDestination(text: string): string | null {
  const labelled = text.match(
    /(?:destination|arrival city|arriving at|to city)\s*[:\-]\s*([A-Za-z][A-Za-z\s]{1,28})/i,
  );
  if (labelled) return labelled[1].trim();

  const airportRoute = text.match(/\b[A-Z]{3}\s*(?:-|–|—|to|→)\s*([A-Z]{3})\b/);
  if (airportRoute) return airportRoute[1].trim();

  const toCity = text.match(/\bto\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)\b/);
  if (toCity) return toCity[1].trim();

  return null;
}

export function parseItineraryText(text: string): ParsedItinerary {
  const { startDate, endDate } = extractDateRange(text);
  return {
    destination: extractDestination(text),
    startDate,
    endDate,
    flight: extractFlight(text),
  };
}
