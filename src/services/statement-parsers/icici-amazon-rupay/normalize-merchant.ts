/**
 * A real RuPay-variant statement is spent almost entirely via UPI, and
 * every UPI-routed row's description is "UPI-<per-transaction reference
 * number>-<merchant text>" -- e.g. "UPI-616622925270-TOBOX VE NTURES".
 * That reference number is different on every single transaction even
 * for the exact same merchant, so leaving it in place would make
 * normalizeMerchant return a different "merchant" for every UPI charge
 * and defeat the whole point of merchant normalization. Stripped first,
 * before any other rule below runs.
 */
const UPI_REFERENCE_PREFIX = /^UPI-\d+-/i;

/**
 * Known merchant name variants seen on a real Amazon Pay or RuPay-variant
 * ICICI statement -- checked as a prefix match (case-insensitive) after
 * the UPI reference prefix above is stripped, same approach as
 * axis-horizon's own KNOWN_MERCHANT_PREFIXES. "TOBOX VE NTURES" (note the
 * mangled internal space -- see the comment on stripKnownCitySuffix)
 * is this statement's single most frequent merchant by transaction
 * count; folded to one canonical name rather than becoming a
 * differently-spaced Merchant Dictionary entry every time.
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
  ["TOBOX VE NTURES", "Tobox Ventures"],
  ["TOBOX VENTURES", "Tobox Ventures"],
];

// Payment-aggregator prefixes that route a real merchant's charge through
// their own gateway id -- stripped so the underlying merchant name (or,
// for the merchants above, the KNOWN_MERCHANT_PREFIXES match) is what's
// left. "RAZ*"/"CAS*"/"PAY*"/"PYU*" are Razorpay/Cashfree/PayU-style
// aggregator tags actually seen in a real statement.
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

// Every real row in these statements ends its description with a
// trailing "IN" (domestic) or "US*" (a US-based merchant) country
// marker -- stripped the same way city names are, so it doesn't end up
// baked into the normalized merchant name. A UPI-routed row's wrapped
// continuation line (see parse-transactions.ts's collectWrappedContinuation)
// often puts this "IN" on its own trailing fragment, so it must still be
// stripped after that fragment is joined on.
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

  const withoutUpiPrefix = trimmed.replace(UPI_REFERENCE_PREFIX, "");

  const upper = withoutUpiPrefix.toUpperCase();
  for (const [prefix, name] of KNOWN_MERCHANT_PREFIXES) {
    if (upper.startsWith(prefix)) return name;
  }

  let working = withoutUpiPrefix.replace(TRAILING_COUNTRY_MARKER, "").trim();
  for (const pattern of PROCESSOR_PREFIXES) {
    working = working.replace(pattern, "");
  }
  working = stripKnownCitySuffix(working).trim();
  working = working.replace(/\s{2,}/g, " ");

  return working ? titleCase(working) : titleCase(withoutUpiPrefix || trimmed);
}
