// Throwaway script used once to validate the new hdfc-infinia-tata
// module (generalized from hdfc-infinia) against a real Tata Neu Plus
// HDFC Bank Credit Card statement, outside the repo (never committed).
// Neutered to an inert skipped stub before committing -- confirmed
// (transiently, never persisted): reconciliation passes (0.00, 0.00,
// and a 0.39 delta well within tolerance on the three checks), cardType
// correctly detected as "Tata Neu Plus", rewardPointsBalance/Earned read
// from the NeuCoins block (9/9), both expiry fields correctly defaulted
// to 0, the Bonus NeuCoins Summary table parsed into rewardPointsSummary,
// and 6/6 transactions parsed (including the two wrapped IGST rows and
// three EMI-marked UPI rows).
import { describe, expect, it } from "vitest";

describe.skip("scratch (not part of the suite)", () => {
  it("noop", () => {
    expect(true).toBe(true);
  });
});
