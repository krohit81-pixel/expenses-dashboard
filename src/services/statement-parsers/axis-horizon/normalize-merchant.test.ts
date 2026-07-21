import { describe, expect, it } from "vitest";

import { normalizeMerchant } from "./normalize-merchant";

describe("normalizeMerchant", () => {
  it("returns null for empty input", () => {
    expect(normalizeMerchant("   ")).toBeNull();
  });

  it("title-cases an ordinary merchant name", () => {
    expect(normalizeMerchant("SOME MERCHANT")).toBe("Some Merchant");
  });

  it("uses a known-merchant prefix override regardless of trailing city", () => {
    expect(normalizeMerchant("ISS FACILITY SERVICES,PUNE")).toBe(
      "ISS Facility Services",
    );
  });

  it("strips a known city suffix glued directly onto an otherwise-unlisted name", () => {
    expect(normalizeMerchant("BLINKIT,GURGAON")).toBe("Blinkit,");
  });

  it("recognizes an explicitly listed merchant regardless of suffix", () => {
    expect(normalizeMerchant("MYGATE")).toBe("MyGate");
  });

  it("strips a trailing foreign-currency amount", () => {
    expect(normalizeMerchant("SOME EURO MERCHANT EUR 180.00")).toBe(
      "Some Euro Merchant",
    );
  });

  it("strips a known payment-processor prefix", () => {
    expect(normalizeMerchant("MSW*SOME MERCHANT")).toBe("Some Merchant");
  });
});
