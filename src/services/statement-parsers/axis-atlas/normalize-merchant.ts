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

const PROCESSOR_PREFIXES = [/^MSW\*/i, /^TP\s+/i];
const KNOWN_CITY_SUFFIXES = [
  "MUMBAI",
  "PUNE",
  "BANGALORE",
  "BENGALURU",
  "NEW DELHI",
  "SOUTH DELHI",
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

  let working = stripTrailingForeignAmount(trimmed).trim();
  for (const pattern of PROCESSOR_PREFIXES) {
    working = working.replace(pattern, "");
  }
  working = stripKnownCitySuffix(working).trim();
  working = working.replace(/\s{2,}/g, " ");

  return working ? titleCase(working) : titleCase(trimmed);
}
