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

// International Transactions rows embed the foreign-currency amount
// directly in the description text, with no delimiter from the merchant
// name (e.g. "EURO DISNEY ASSOCIESCHESSY  EUR 180.00", "GRUPO
// IBEROSTARSantanyi -  EUR 1176.78"). Left in place, this would make
// merchantNormalized differ per transaction for the same merchant --
// every distinct forex amount would look like a different merchant to
// the Merchant Dictionary's matching. Stripped here, same fixed-list
// spirit as KNOWN_CITY_SUFFIXES: extend as new statements surface more
// currencies. A trailing "-" sometimes separates the name from the
// amount column too (e.g. the Iberostar example above) and is stripped
// along with it.
const FOREIGN_CURRENCY_CODES = [
  "USD",
  "EUR",
  "GBP",
  "AED",
  "SGD",
  "AUD",
  "CAD",
  "CHF",
  "JPY",
];
const TRAILING_FOREIGN_AMOUNT = new RegExp(
  `\\s*-?\\s*\\b(?:${FOREIGN_CURRENCY_CODES.join("|")})\\s+\\d+(?:\\.\\d{2})?\\s*$`,
);

function stripTrailingForeignAmount(text: string): string {
  return text.replace(TRAILING_FOREIGN_AMOUNT, "");
}

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

  let working = stripTrailingForeignAmount(trimmed).trim();
  for (const pattern of PROCESSOR_PREFIXES) {
    working = working.replace(pattern, "");
  }
  working = stripKnownCitySuffix(working).trim();
  working = working.replace(/\s{2,}/g, " ");

  return working ? titleCase(working) : titleCase(trimmed);
}
