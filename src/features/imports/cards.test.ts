import { describe, expect, it } from "vitest";

import { guessCardAccountId } from "@/features/imports/cards";

describe("guessCardAccountId", () => {
  const accounts = [
    { id: "hdfc-infinia-id", name: "HDFC Infinia" },
    { id: "hdfc-tata-id", name: "HDFC Tata Neu Plus" },
    { id: "axis-id", name: "Axis Horizon Credit Card" },
    { id: "icici-id", name: "ICICI Amazon Pay" },
    { id: "checking-id", name: "HDFC Salary Account" }, // not a card, just here to prove keyword overlap alone isn't disqualifying by type — the caller is expected to pass only credit_card accounts in.
  ];

  it("picks the account whose name best matches the statement's card label", () => {
    expect(guessCardAccountId("icici-amazon-rupay", accounts)).toBe("icici-id");
    expect(guessCardAccountId("axis-horizon-airtel", accounts)).toBe("axis-id");
  });

  it("disambiguates between two accounts that share a keyword (HDFC) by the more specific one scoring higher", () => {
    expect(guessCardAccountId("hdfc-infinia", accounts)).toBe(
      "hdfc-infinia-id",
    );
    expect(guessCardAccountId("hdfc-tata-neu", accounts)).toBe("hdfc-tata-id");
  });

  it("returns null when no account name shares any keyword with the statement's card label", () => {
    const noMatch = [{ id: "x", name: "Random Savings Account" }];
    expect(guessCardAccountId("icici-amazon-rupay", noMatch)).toBeNull();
  });

  it("returns null for an empty account list", () => {
    expect(guessCardAccountId("hdfc-infinia", [])).toBeNull();
  });
});
