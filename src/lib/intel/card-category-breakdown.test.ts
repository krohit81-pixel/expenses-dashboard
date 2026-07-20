import { describe, expect, it } from "vitest";

import {
  buildCardCategoryBreakdown,
  buildMonthlyCardTotals,
  type CardTransactionRow,
  type MonthlyCardTransactionRow,
} from "./card-category-breakdown";

function row(overrides: Partial<CardTransactionRow> = {}): CardTransactionRow {
  return {
    amount: 100,
    issuer: "HDFC",
    cardType: "Infinia",
    cardLast4: "5252",
    atlasCategoryId: "cat-food",
    ...overrides,
  };
}

describe("buildCardCategoryBreakdown", () => {
  it("returns no cards and a zero aggregate for no rows", () => {
    const result = buildCardCategoryBreakdown([]);
    expect(result.cards).toEqual([]);
    expect(result.aggregate).toEqual({ totalSpend: "0.00", byCategory: [] });
  });

  it("groups a single card's rows by category", () => {
    const result = buildCardCategoryBreakdown([
      row({ amount: 100, atlasCategoryId: "cat-food" }),
      row({ amount: 50, atlasCategoryId: "cat-food" }),
      row({ amount: 200, atlasCategoryId: "cat-travel" }),
    ]);

    expect(result.cards).toHaveLength(1);
    const [card] = result.cards;
    expect(card).toMatchObject({
      cardLabel: "HDFC Infinia •••• 5252",
      totalSpend: "350.00",
    });
    expect(card.byCategory).toEqual(
      expect.arrayContaining([
        { categoryId: "cat-food", total: "150.00" },
        { categoryId: "cat-travel", total: "200.00" },
      ]),
    );
  });

  it("keeps a transaction with no category as a null-keyed uncategorized bucket", () => {
    const result = buildCardCategoryBreakdown([
      row({ amount: 75, atlasCategoryId: null }),
    ]);
    expect(result.cards[0]?.byCategory).toEqual([
      { categoryId: null, total: "75.00" },
    ]);
  });

  it("splits transactions across multiple cards, sorted by highest spend first", () => {
    const result = buildCardCategoryBreakdown([
      row({
        amount: 100,
        issuer: "HDFC",
        cardType: "Infinia",
        cardLast4: "5252",
      }),
      row({
        amount: 900,
        issuer: "ICICI",
        cardType: "Amazon Pay",
        cardLast4: "1234",
      }),
      row({
        amount: 50,
        issuer: "HDFC",
        cardType: "Infinia",
        cardLast4: "5252",
      }),
    ]);

    expect(result.cards.map((c) => c.cardLabel)).toEqual([
      "ICICI Amazon Pay •••• 1234",
      "HDFC Infinia •••• 5252",
    ]);
    expect(result.cards[0]?.totalSpend).toBe("900.00");
    expect(result.cards[1]?.totalSpend).toBe("150.00");
  });

  it("aggregates across every card combined", () => {
    const result = buildCardCategoryBreakdown([
      row({
        amount: 100,
        issuer: "HDFC",
        cardType: "Infinia",
        cardLast4: "5252",
        atlasCategoryId: "cat-food",
      }),
      row({
        amount: 200,
        issuer: "ICICI",
        cardType: "Amazon Pay",
        cardLast4: "1234",
        atlasCategoryId: "cat-food",
      }),
      row({
        amount: 50,
        issuer: "ICICI",
        cardType: "Amazon Pay",
        cardLast4: "1234",
        atlasCategoryId: "cat-travel",
      }),
    ]);

    expect(result.aggregate.totalSpend).toBe("350.00");
    expect(result.aggregate.byCategory).toEqual(
      expect.arrayContaining([
        { categoryId: "cat-food", total: "300.00" },
        { categoryId: "cat-travel", total: "50.00" },
      ]),
    );
  });

  it("treats two different cards with the same last 4 digits as distinct", () => {
    // Different issuers/products can plausibly share a last-4 by
    // coincidence -- the grouping key is the full (issuer, cardType,
    // cardLast4) triple, not cardLast4 alone.
    const result = buildCardCategoryBreakdown([
      row({
        issuer: "HDFC",
        cardType: "Infinia",
        cardLast4: "1234",
        amount: 10,
      }),
      row({
        issuer: "ICICI",
        cardType: "Amazon Pay",
        cardLast4: "1234",
        amount: 20,
      }),
    ]);
    expect(result.cards).toHaveLength(2);
  });
});

function monthlyRow(
  overrides: Partial<MonthlyCardTransactionRow> = {},
): MonthlyCardTransactionRow {
  return {
    amount: 100,
    cycleMonth: "2026-06",
    atlasCategoryId: "cat-food",
    ...overrides,
  };
}

describe("buildMonthlyCardTotals", () => {
  it("returns nothing for no rows", () => {
    expect(buildMonthlyCardTotals([])).toEqual([]);
  });

  it("groups every card's spend together by cycle month, ignoring which card", () => {
    const result = buildMonthlyCardTotals([
      monthlyRow({ cycleMonth: "2026-06", amount: 100 }),
      monthlyRow({ cycleMonth: "2026-06", amount: 50 }),
      monthlyRow({ cycleMonth: "2026-07", amount: 200 }),
    ]);
    const june = result.find((r) => r.month === "2026-06");
    const july = result.find((r) => r.month === "2026-07");
    expect(june?.totalSpend).toBe("150.00");
    expect(july?.totalSpend).toBe("200.00");
  });

  it("groups by the statement's cycle month, not the transaction's own date", () => {
    // The whole point of cycle tagging: two transactions dated in
    // different calendar months (because the billing period spans a
    // boundary) still land in the same bucket if they came off the
    // same statement, i.e. share the same cycleMonth.
    const result = buildMonthlyCardTotals([
      monthlyRow({ cycleMonth: "2026-07", amount: 100 }),
      monthlyRow({ cycleMonth: "2026-07", amount: 50 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.month).toBe("2026-07");
    expect(result[0]?.totalSpend).toBe("150.00");
  });

  it("groups within a month by category, keeping null as uncategorized", () => {
    const result = buildMonthlyCardTotals([
      monthlyRow({ atlasCategoryId: "cat-food", amount: 100 }),
      monthlyRow({ atlasCategoryId: "cat-food", amount: 50 }),
      monthlyRow({ atlasCategoryId: null, amount: 25 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.byCategory).toEqual(
      expect.arrayContaining([
        { categoryId: "cat-food", total: "150.00" },
        { categoryId: null, total: "25.00" },
      ]),
    );
  });
});
