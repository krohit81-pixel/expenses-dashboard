/**
 * Best-effort merchant cleanup, not a full NLP normalizer -- HDFC's
 * statement text mashes a merchant's payment-processor name, city, and
 * sometimes stray codes together with no delimiter ("GOOGLE CLOUDMUMBAI",
 * "MSW*RAINTREE VETERINARY Pune"), so there's no fully general way to
 * recover the "real" merchant name from text alone. merchant_raw is
 * always kept alongside this (see the schema) precisely because this is
 * a heuristic, not a guarantee.
 *
 * Two layers: a small dictionary of merchants worth naming exactly
 * (matched by prefix, since the trailing city/code varies), then a
 * generic fallback for everything else -- strip a handful of known
 * processor prefixes and trailing city names observed on real
 * statements, then title-case what's left.
 */

const KNOWN_MERCHANT_PREFIXES: [prefix: string, name: string][] = [
  ["GOOGLE CLOUD", "Google Cloud"],
  ["GOOGLE PLAY CONTENT", "Google Play"],
  ["GOOGLE PLAY", "Google Play"],
  ["GYFTR VIA SMARTBUY", "Gyftr SmartBuy"],
  ["THIRD WAVE COFFEE", "Third Wave Coffee"],
  ["SEPHORA", "Sephora"],
  ["MYGATE", "MyGate"],
  ["ISS FACILITY SERVICES", "ISS Facility Services"],
];

// Payment-processor / gateway prefixes seen prepended to the actual
// merchant name, with no separator worth keeping.
const PROCESSOR_PREFIXES = [/^MSW\*/i, /^TP\s+/i];

// City/place names observed appended directly to a merchant name with no
// space (e.g. "COFFEEPUNE", "MUMBAI"). Deliberately a fixed list, not a
// general gazetteer -- extend as new statements surface more.
const KNOWN_CITY_SUFFIXES = [
  "MUMBAI",
  "PUNE",
  "BANGALORE",
  "BENGALURU",
  "NEW DELHI",
  "SOUTH DELHI",
  "SOUTH DELH",
  "DELHI",
  "CHENNAI",
  "KOLKATA",
  "HYDERABAD",
  "INDORE",
  "KHOPOLI",
  "RAIGAD",
  "GURGAON",
  "GURUGRAM",
  "NOIDA",
];

const SMALL_WORDS = new Set([
  "and",
  "of",
  "the",
  "via",
  "on",
  "or",
  "in",
  "at",
]);

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && SMALL_WORDS.has(word)) return word;
      // Keep an existing internal capital (e.g. "McDonald's") rather than
      // flattening every word to a simple capital+lowercase shape.
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function stripKnownCitySuffix(text: string): string {
  const upper = text.toUpperCase();
  for (const city of KNOWN_CITY_SUFFIXES) {
    if (upper.endsWith(city) && upper.length > city.length) {
      return text.slice(0, text.length - city.length);
    }
  }
  return text;
}

/**
 * Returns null for input that isn't really a merchant name at all (the
 * caller is responsible for only calling this on rows already identified
 * as merchant purchases -- see parse-transactions.ts).
 */
export function normalizeMerchant(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  for (const [prefix, name] of KNOWN_MERCHANT_PREFIXES) {
    if (upper.startsWith(prefix)) return name;
  }

  let working = trimmed;
  for (const pattern of PROCESSOR_PREFIXES) {
    working = working.replace(pattern, "");
  }
  working = stripKnownCitySuffix(working).trim();
  working = working.replace(/\s{2,}/g, " ");

  return working ? titleCase(working) : titleCase(trimmed);
}
