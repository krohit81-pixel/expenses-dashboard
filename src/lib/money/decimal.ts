import Decimal from "decimal.js";

/**
 * A dedicated Decimal constructor for money math, configured once here so
 * every caller gets the same precision/rounding behavior. Do not import
 * "decimal.js" directly elsewhere in the app — go through src/lib/money/
 * so amounts stay fixed-precision decimal strings at every boundary
 * (see docs/03-database-design.md and docs/08-engineering-standards.md).
 */
Decimal.set({
  precision: 34, // generous intermediate precision; we round to 2dp on output
  rounding: Decimal.ROUND_HALF_EVEN, // banker's rounding — avoids systematic bias
});

export { Decimal };
