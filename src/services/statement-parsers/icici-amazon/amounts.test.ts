import { describe, expect, it } from "vitest";

import {
  findAllAmounts,
  findAmount,
  findDecimalAmount,
  findInteger,
} from "./amounts";

describe("findAmount", () => {
  it("parses an Indian-grouped decimal amount", () => {
    expect(findAmount("`1,12,465.38")).toBe("112465.38");
  });

  it("parses a plain decimal amount under 1000 with no grouping", () => {
    expect(findAmount("333.95")).toBe("333.95");
  });

  it("returns null when no amount-shaped token is present", () => {
    expect(findAmount("no numbers here")).toBeNull();
  });
});

describe("findDecimalAmount", () => {
  it("requires the 2-decimal suffix", () => {
    expect(findDecimalAmount("SerNo. 150.00")).toBe("150.00");
  });

  it("returns null for a bare integer with no decimal part", () => {
    expect(findDecimalAmount("1348")).toBeNull();
  });
});

describe("findAllAmounts", () => {
  it("finds every amount-shaped token in reading order", () => {
    expect(
      findAllAmounts("`7,35,757.25 `1,12,659.38 `0.00 `7,35,951.25"),
    ).toEqual(["735757.25", "112659.38", "0.00", "735951.25"]);
  });
});

describe("findInteger", () => {
  it("parses a thousands-grouped integer", () => {
    expect(findInteger("1,348")).toBe(1348);
  });

  it("parses a plain integer with no thousands separator at all", () => {
    expect(findInteger("1348")).toBe(1348);
  });

  it("returns null when no digits are present", () => {
    expect(findInteger("no digits")).toBeNull();
  });
});
