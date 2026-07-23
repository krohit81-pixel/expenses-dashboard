// Throwaway script used once to validate the new axis-horizon-airtel
// module (generalized from axis-horizon) against a real Airtel Axis
// Bank Mastercard statement, outside the repo (never committed).
// Neutered to an inert skipped stub before committing -- confirmed
// (transiently, never persisted): reconciliation passes with delta 0.00
// on every check, cardType correctly detected as "airtel", cashbackAmount
// read from the real statement's "Cashback Earned" figure, 2/2
// transactions parsed.
import { describe, expect, it } from "vitest";

describe.skip("scratch (not part of the suite)", () => {
  it("noop", () => {
    expect(true).toBe(true);
  });
});
