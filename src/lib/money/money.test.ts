import { describe, expect, it } from "vitest";

import {
  addMoney,
  compareMoney,
  dbNumberToMoney,
  formatMoneyDisplay,
  isMoney,
  isNegativeMoney,
  isPositiveMoney,
  isZeroMoney,
  moneyToDbNumber,
  negateMoney,
  signedMoneyColorClass,
  subtractMoney,
  sumMoney,
  ZERO,
  zMoney,
  zNonNegativeMoney,
  zPositiveMoney,
  type Money,
} from "./money";

const m = (value: string) => value as Money;

describe("isMoney", () => {
  it.each(["0.00", "12.50", "-3.00", "1000000.99"])("accepts %s", (value) => {
    expect(isMoney(value)).toBe(true);
  });

  it.each(["12.5", "12", "12.500", "abc", "", "-0.001", "1,000.00"])(
    "rejects %s",
    (value) => {
      expect(isMoney(value)).toBe(false);
    },
  );
});

describe("arithmetic", () => {
  it("adds without floating-point drift", () => {
    // 0.1 + 0.2 famously != 0.3 in IEEE 754 float math.
    expect(addMoney(m("0.10"), m("0.20"))).toBe("0.30");
  });

  it("subtracts", () => {
    expect(subtractMoney(m("10.00"), m("3.33"))).toBe("6.67");
  });

  it("negates", () => {
    expect(negateMoney(m("5.00"))).toBe("-5.00");
    expect(negateMoney(m("-5.00"))).toBe("5.00");
  });

  it("sums a list, defaulting to zero", () => {
    expect(sumMoney([])).toBe(ZERO);
    expect(sumMoney([m("1.11"), m("2.22"), m("3.33")])).toBe("6.66");
  });

  it("compares", () => {
    expect(compareMoney(m("1.00"), m("2.00"))).toBe(-1);
    expect(compareMoney(m("2.00"), m("1.00"))).toBe(1);
    expect(compareMoney(m("2.00"), m("2.00"))).toBe(0);
  });

  it("classifies sign", () => {
    expect(isZeroMoney(ZERO)).toBe(true);
    expect(isPositiveMoney(m("0.01"))).toBe(true);
    expect(isNegativeMoney(m("-0.01"))).toBe(true);
  });
});

describe("DB boundary conversion", () => {
  it("round-trips through number without precision loss for typical amounts", () => {
    expect(dbNumberToMoney(1234.5)).toBe("1234.50");
    expect(moneyToDbNumber(m("1234.50"))).toBe(1234.5);
  });

  it("rounds a raw DB number to 2dp on the way in", () => {
    expect(dbNumberToMoney(9.999)).toBe("10.00");
  });
});

describe("formatMoneyDisplay", () => {
  it("formats with the given currency", () => {
    expect(formatMoneyDisplay(m("1234.50"), "USD")).toBe("$1,234.50");
    expect(formatMoneyDisplay(m("1234.50"), "INR")).toContain("1,234.50");
  });
});

describe("signedMoneyColorClass", () => {
  it("is green for positive, red for negative, and neutral (undefined) for zero", () => {
    expect(signedMoneyColorClass(m("1.00"))).toBe("text-emerald-600");
    expect(signedMoneyColorClass(m("-1.00"))).toBe("text-destructive");
    expect(signedMoneyColorClass(ZERO)).toBeUndefined();
  });
});

describe("zod schemas", () => {
  it("zMoney accepts negative and positive amounts, normalizing to 2 decimals", () => {
    expect(zMoney.safeParse("-5.00").success).toBe(true);
    expect(zMoney.safeParse("5.00").success).toBe(true);
    const result = zMoney.safeParse("5.0");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("5.00");
  });

  it("zMoney accepts a plain integer with no decimal point at all", () => {
    // The actual bug report this fixes: typing "202000" for a credit
    // limit or recurring amount shouldn't require also typing ".00".
    const result = zMoney.safeParse("202000");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("202000.00");
  });

  it("zMoney accepts one decimal place, padding to two", () => {
    const result = zMoney.safeParse("42.5");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("42.50");
  });

  it("zMoney strips thousands separators and surrounding whitespace", () => {
    const result = zMoney.safeParse(" 2,02,000.00 ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("202000.00");
  });

  it("zMoney still rejects genuinely invalid input", () => {
    expect(zMoney.safeParse("not a number").success).toBe(false);
    expect(zMoney.safeParse("5.123").success).toBe(false);
    expect(zMoney.safeParse("").success).toBe(false);
  });

  it("zPositiveMoney rejects zero and negative", () => {
    expect(zPositiveMoney.safeParse("0.00").success).toBe(false);
    expect(zPositiveMoney.safeParse("-0.01").success).toBe(false);
    expect(zPositiveMoney.safeParse("0.01").success).toBe(true);
  });

  it("zPositiveMoney accepts a plain integer, same leniency as zMoney", () => {
    const result = zPositiveMoney.safeParse("202000");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("202000.00");
  });

  it("zNonNegativeMoney accepts zero but rejects negative", () => {
    expect(zNonNegativeMoney.safeParse("0.00").success).toBe(true);
    expect(zNonNegativeMoney.safeParse("-0.01").success).toBe(false);
  });
});
