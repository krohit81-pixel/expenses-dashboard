/**
 * Known merchant name variants seen on a real Amazon Pay ICICI statement
 * -- checked as a prefix match (case-insensitive) before the generic
 * processor-prefix/city-suffix stripping below, same approach as
 * axis-horizon's own KNOWN_MERCHANT_PREFIXES. Several merchants print
 * under more than one raw shape depending on which payment aggregator
 * routed the charge (e.g. Swiggy via its own gateway vs. via Razorpay's
 * "RAZ*" prefix vs. via "CAS*"), so those all fold into one canonical
 * name here rather than becoming distinct Merchant Dictionary entries.
 */
const KNOWN_MERCHANT_PREFIXES: [prefix: string, name: string][] = [
  ["AMAZON PAY IN GROCERY", "Amazon Fresh"],
  ["AMAZON PAY IN E COMMERC", "Amazon"],
  ["AMAZON INDIA", "Amazon"],
  ["AMAZON", "Amazon"],
  ["INSTAMART", "Swiggy Instamart"],
  ["BUNDL TECHNOLOGIES", "Swiggy"],
  ["WWW SWIGGY COM", "Swiggy"],
  ["SWIGGY", "Swiggy"],
  ["RAZ*SWIGGY", "Swiggy"],
  ["CAS*SWIGGY", "Swiggy"],
  ["ZOMATO", "Zomato"],
  ["BLINKIT", "Blinkit"],
  ["JUBILANT FOODWORKS", "Domino's"],
  ["PYU*JUBILANT FOODWORKS", "Domino's"],
  ["PAY*JUBILANT FOODWORKS", "Domino's"],
  ["HENNES N MAURITZ", "H&M"],
  ["IKEA", "Ikea"],
  ["TATA STARBUCKS", "Starbucks"],
  ["CROSSWORD BOOKSTORES", "Crossword"],
  ["SMART BAZAAR", "Smart Bazaar"],
  ["MAJOR BRANDS", "Major Brands"],
  ["GIVA", "Giva"],
  ["VERCEL", "Vercel"],
  ["BLOOMBERG", "Bloomberg"],
];

// Payment-aggregator prefixes that route a real merchant's charge through
// their own gateway id -- stripped so the underlying merchant name (or,
// for the merchants above, the KNOWN_MERCHANT_PREFIXES match) is what's
// left. "RAZ*"/"CAS*"/"PAY*"/"PYU*" are Razorpay/Cashfree/PayU-style
// aggregator tags actually seen in this statement's transaction table.
const PROCESSOR_PREFIXES = [/^RAZ\*/i, /^CAS\*/i, /^PAY\*/i, /^PYU\*/i];

const KNOWN_CITY_SUFFIXES = [
  "BANGALORE",
  "BENGALURU",
  "GURGAON",
  "GURUGRAM",
  "PUNE",
  "MUMBAI",
  "NEW DELHI",
  "DELHI",
  "KOLKATA",
  "HYDERABAD",
  "CHENNAI",
];

// Every real row in this statement ends its description with a trailing
// "IN" (domestic) or "US*" (a US-based merchant) country marker --
// stripped the same way city names are, so it doesn't end up baked into
// the normalized merchant name.
const TRAILING_COUNTRY_MARKER = /\s+(?:IN|US\*?)$/i;

const SMALL_WORDS = new Set(["and", "of", "the", "n"]);

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && SMALL_WORDS.has(word)) return word;
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

export function normalizeMerchant(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  for (const [prefix, name] of KNOWN_MERCHANT_PREFIXES) {
    if (upper.startsWith(prefix)) return name;
  }

  let working = trimmed.replace(TRAILING_COUNTRY_MARKER, "").trim();
  for (const pattern of PROCESSOR_PREFIXES) {
    working = working.replace(pattern, "");
  }
  working = stripKnownCitySuffix(working).trim();
  working = working.replace(/\s{2,}/g, " ");

  return working ? titleCase(working) : titleCase(trimmed);
}
