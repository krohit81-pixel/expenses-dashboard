import { describe, expect, it } from "vitest";

import {
  findAllAmounts,
  findAmount,
  findDecimalAmount,
  findInteger,
} from "./amounts";

describe("findAmount", () => {
  it("parses a thousands-grouped decimal amount", () => {
    expect(findAmount("2,104,812.00")).toBe("2104812.00");
  });

  it("parses a plain decimal amount under 1000 with no grouping", () => {
    expect(findAmount("549.00")).toBe("549.00");
  });

  it("returns null when no amount-shaped token is present", () => {
    expect(findAmount("no numbers here")).toBeNull();
  });
});

describe("findDecimalAmount", () => {
  it("requires the 2-decimal suffix", () => {
    expect(findDecimalAmount("5% CashBack on SmartPay 150.00")).toBe("150.00");
  });

  it("returns null for a bare integer with no decimal part", () => {
    expect(findDecimalAmount("5%")).toBeNull();
  });
});

describe("findAllAmounts", () => {
  it("finds every amount-shaped token in reading order", () => {
    expect(findAllAmounts("57,607.29 Dr 57,607.29 1,066.46 89,202.15")).toEqual(
      ["57607.29", "57607.29", "1066.46", "89202.15"],
    );
  });
});

describe("findInteger", () => {
  it("parses a thousands-grouped integer", () => {
    expect(findInteger("1,09,391")).toBe(109391);
  });

  /**
   * The real bug this test guards against: Axis's eDGE Miles balance is
   * printed with NO thousands separator at all (unlike every HDFC
   * figure this pattern was originally written against). The original
   * `\d{1,3}(?:,\d{2,3})*` pattern silently truncated a 5-digit ungrouped
   * number at the first 3 digits (matching "262" out of "26276") since
   * the comma-group repetition is optional and a bare digit run has no
   * comma to require more of it.
   */
  it("parses a plain integer with no thousands separator at all", () => {
    expect(findInteger("26276")).toBe(26276);
  });

  it("returns null when no digits are present", () => {
    expect(findInteger("no digits")).toBeNull();
  });
});
