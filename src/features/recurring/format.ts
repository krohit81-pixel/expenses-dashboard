const FREQUENCY_UNIT: Record<string, string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  quarterly: "quarter",
  yearly: "year",
};

/**
 * "every month", "every 3 months" — the actual cadence, not an assumption.
 * Extracted after finding RecurringLineItem hardcoded "Every month" for
 * every template regardless of its real frequency/interval, which meant
 * a template mistakenly set to "every 10 months" still displayed as
 * "Every month" — part of why that mistake wasn't obvious until it was
 * pointed out.
 */
export function formatFrequency(
  frequency: string,
  intervalCount: number,
): string {
  const unit = FREQUENCY_UNIT[frequency] ?? frequency;
  if (intervalCount === 1) {
    return `every ${unit}`;
  }
  return `every ${intervalCount} ${unit}s`;
}
