import { describe, expect, it } from "vitest";

import { normalizeMerchant } from "./normalize-merchant";

describe("normalizeMerchant", () => {
  it("returns null for an empty string", () => {
    expect(normalizeMerchant("   ")).toBeNull();
  });

  it("strips a trailing city and country marker for an unrecognized merchant", () => {
    expect(normalizeMerchant("SOME NEW SHOP PUNE IN")).toBe("Some New Shop");
  });

  it("folds Amazon's grocery-specific variant into Amazon Fresh", () => {
    expect(normalizeMerchant("AMAZON PAY IN GROCERY BANGALORE IN")).toBe(
      "Amazon Fresh",
    );
  });

  it("folds Amazon's e-commerce variant into Amazon", () => {
    expect(normalizeMerchant("AMAZON PAY IN E COMMERC BANGALORE IN")).toBe(
      "Amazon",
    );
  });

  it("folds a Razorpay-routed Swiggy charge into Swiggy", () => {
    expect(normalizeMerchant("RAZ*Swiggy Bangalore KA IN")).toBe("Swiggy");
  });

  it("folds Swiggy's Instamart variant into Swiggy Instamart", () => {
    expect(normalizeMerchant("INSTAMART BANGALORE IN")).toBe(
      "Swiggy Instamart",
    );
  });

  it("folds a PayU-routed Jubilant Foodworks (Domino's) charge", () => {
    expect(normalizeMerchant("PYU*JUBILANT FOODWORKS WWW.DOMINOS.C IN")).toBe(
      "Domino's",
    );
  });

  it("folds Hennes N Mauritz into H&M", () => {
    expect(normalizeMerchant("HENNES N MAURITZ PUNE IN")).toBe("H&M");
  });

  it("title-cases a merchant with no known prefix or city match", () => {
    expect(normalizeMerchant("JW MARRIOTT SPICE KITH")).toBe(
      "Jw Marriott Spice Kith",
    );
  });
});
