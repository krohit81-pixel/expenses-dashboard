import { describe, expect, it } from "vitest";

import { normalizeMerchant } from "./normalize-merchant";

describe("normalizeMerchant", () => {
  it("returns null for empty or whitespace-only input", () => {
    expect(normalizeMerchant("")).toBeNull();
    expect(normalizeMerchant("   ")).toBeNull();
  });

  it("matches a dictionary entry by prefix, ignoring a trailing city", () => {
    expect(normalizeMerchant("GOOGLE CLOUDMUMBAI")).toBe("Google Cloud");
    expect(normalizeMerchant("GYFTR VIA SMARTBUYNEW DELHI")).toBe(
      "Gyftr SmartBuy",
    );
    expect(normalizeMerchant("THIRD WAVE COFFEEPUNE")).toBe(
      "Third Wave Coffee",
    );
  });

  it("prefers the more specific dictionary entry when two share a prefix", () => {
    // "GOOGLE PLAY CONTENT" must win over the shorter "GOOGLE PLAY" entry.
    expect(normalizeMerchant("GOOGLE PLAY CONTENT PUMUMBAI")).toBe(
      "Google Play",
    );
  });

  it("strips a known processor prefix not in the dictionary", () => {
    expect(normalizeMerchant("MSW*SOME VET CLINICPUNE")).toBe(
      "Some Vet Clinic",
    );
    expect(normalizeMerchant("TP SOME RETAILERNOIDA")).toBe("Some Retailer");
  });

  it("strips a known trailing city suffix with no delimiter", () => {
    expect(normalizeMerchant("WINE TERMINALPUNE")).toBe("Wine Terminal");
    expect(normalizeMerchant("MYGATEBANGALORE")).toBe("MyGate");
  });

  it("does not truncate real words that merely contain a dictionary match as a substring elsewhere", () => {
    // The dictionary match is a startsWith check, so this should NOT match
    // the "MYGATE" entry -- it doesn't start with it.
    expect(normalizeMerchant("SOMEMYGATE PLACEPUNE")).toBe("Somemygate Place");
  });

  it("keeps the full business name when a longer generic name has a city suffix", () => {
    expect(normalizeMerchant("UNO UNISEX SALON CLINIC PUNE")).toBe(
      "Uno Unisex Salon Clinic",
    );
  });

  it("title-cases small/connector words only when not the first word", () => {
    expect(normalizeMerchant("H AND M HENNES ANDSOUTH DELHI")).toBe(
      "H and M Hennes and",
    );
  });

  it("falls back to title-casing the raw text when nothing matches", () => {
    expect(normalizeMerchant("SOME UNKNOWN MERCHANT XYZ")).toBe(
      "Some Unknown Merchant Xyz",
    );
  });

  it("collapses double spaces left behind after stripping a prefix/suffix", () => {
    expect(normalizeMerchant("TP  DOUBLE SPACE MERCHANTNOIDA")).toBe(
      "Double Space Merchant",
    );
  });
});
