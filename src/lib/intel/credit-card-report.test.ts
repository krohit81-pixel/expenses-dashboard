import { describe, expect, it } from "vitest";

import {
  buildCombinedTransactionTable,
  buildLargestTransactions,
  buildLlmAnalysisPrompt,
  buildPerCardSummary,
  buildReportCategoryMerchantBreakdown,
  buildReportCategoryTotals,
  buildTopMerchantsOverall,
  computeGrandTotal,
  donutArcPath,
} from "./credit-card-report";
import type { LatestCycleReportCard } from "@/services/CreditCardIntelService";

function txn(
  overrides: Partial<LatestCycleReportCard["transactions"][number]> = {},
): LatestCycleReportCard["transactions"][number] {
  return {
    id: "txn-1",
    date: "2026-08-10",
    description: "Raymond",
    amount: "100.00" as never,
    currency: "INR",
    merchantId: "merch-raymond",
    merchantDisplayName: "Raymond",
    atlasCategoryId: "cat-shopping",
    atlasSubcategoryId: "cat-clothing",
    ...overrides,
  };
}

function card(
  overrides: Partial<LatestCycleReportCard> = {},
): LatestCycleReportCard {
  return {
    cardKey: "HDFC|Infinia|1234",
    cardLabel: "HDFC Infinia •••• 1234",
    issuer: "HDFC",
    primaryCardholder: "Rohit",
    statementDate: "2026-08-05",
    cycleMonth: "2026-08",
    billingPeriodStart: "2026-07-06",
    billingPeriodEnd: "2026-08-05",
    dueDate: "2026-08-25",
    totalAmountDue: "1000.00" as never,
    minimumDue: "100.00" as never,
    availableCreditLimit: "50000.00" as never,
    totalCreditLimit: "100000.00" as never,
    transactions: [txn()],
    ...overrides,
  };
}

const categoryName = new Map([
  ["cat-shopping", "Shopping"],
  ["cat-clothing", "Clothing"],
  ["cat-dining", "Dining"],
]);

describe("computeGrandTotal", () => {
  it("sums every transaction across every card", () => {
    const cards = [
      card({ transactions: [txn({ amount: "100.00" as never })] }),
      card({
        cardKey: "Axis|Horizon|5678",
        transactions: [txn({ amount: "50.00" as never })],
      }),
    ];
    expect(computeGrandTotal(cards)).toBe("150.00");
  });

  it("returns zero for no cards", () => {
    expect(computeGrandTotal([])).toBe("0.00");
  });
});

describe("buildReportCategoryTotals", () => {
  it("sums the same category across multiple cards", () => {
    const cards = [
      card({ transactions: [txn({ amount: "100.00" as never })] }),
      card({
        cardKey: "Axis|Horizon|5678",
        transactions: [txn({ amount: "50.00" as never })],
      }),
    ];
    const totals = buildReportCategoryTotals(cards);
    expect(totals).toEqual([{ categoryId: "cat-shopping", total: "150.00" }]);
  });

  it("buckets uncategorized transactions under an empty-string categoryId", () => {
    const cards = [
      card({
        transactions: [
          txn({ atlasCategoryId: null, amount: "40.00" as never }),
        ],
      }),
    ];
    expect(buildReportCategoryTotals(cards)).toEqual([
      { categoryId: "", total: "40.00" },
    ]);
  });
});

describe("buildReportCategoryMerchantBreakdown", () => {
  it("groups merchants under their category with percentages summing to ~100%", () => {
    const cards = [
      card({
        transactions: [
          txn({
            merchantId: "merch-raymond",
            merchantDisplayName: "Raymond",
            amount: "75.00" as never,
          }),
          txn({
            id: "txn-2",
            merchantId: "merch-zara",
            merchantDisplayName: "Zara",
            atlasSubcategoryId: "cat-clothing",
            amount: "25.00" as never,
          }),
        ],
      }),
    ];
    const [shopping] = buildReportCategoryMerchantBreakdown(
      cards,
      categoryName,
    );
    expect(shopping.categoryName).toBe("Shopping");
    expect(shopping.total).toBe("100.00");
    expect(shopping.percentOfGrandTotal).toBeCloseTo(100, 5);
    const pctSum = shopping.merchants.reduce(
      (sum, m) => sum + m.percentOfCategory,
      0,
    );
    expect(pctSum).toBeCloseTo(100, 5);
    expect(shopping.merchants.map((m) => m.displayName)).toEqual([
      "Raymond",
      "Zara",
    ]);
    expect(shopping.merchants[0].subcategoryName).toBe("Clothing");
  });

  it("falls back to 'No merchant tagged' and a null subcategory when untagged", () => {
    const cards = [
      card({
        transactions: [
          txn({
            merchantId: null,
            merchantDisplayName: null,
            atlasSubcategoryId: null,
          }),
        ],
      }),
    ];
    const [breakdown] = buildReportCategoryMerchantBreakdown(
      cards,
      categoryName,
    );
    expect(breakdown.merchants[0].displayName).toBe("No merchant tagged");
    expect(breakdown.merchants[0].subcategoryName).toBeNull();
  });

  it("sorts categories by total spend descending", () => {
    const cards = [
      card({
        transactions: [
          txn({ atlasCategoryId: "cat-dining", amount: "10.00" as never }),
          txn({
            id: "txn-2",
            atlasCategoryId: "cat-shopping",
            amount: "90.00" as never,
          }),
        ],
      }),
    ];
    const breakdown = buildReportCategoryMerchantBreakdown(cards, categoryName);
    expect(breakdown.map((b) => b.categoryName)).toEqual([
      "Shopping",
      "Dining",
    ]);
  });
});

describe("buildPerCardSummary", () => {
  it("computes utilization from available vs total credit limit", () => {
    const cards = [
      card({
        availableCreditLimit: "25000.00" as never,
        totalCreditLimit: "100000.00" as never,
      }),
    ];
    const [row] = buildPerCardSummary(cards);
    expect(row.utilizationPercent).toBeCloseTo(75, 5);
  });

  it("returns null utilization when the card has no credit limit to divide by", () => {
    const cards = [
      card({
        totalCreditLimit: "0.00" as never,
        availableCreditLimit: "0.00" as never,
      }),
    ];
    const [row] = buildPerCardSummary(cards);
    expect(row.utilizationPercent).toBeNull();
  });

  it("sorts cards by cycle spend descending and computes % of grand total", () => {
    const cards = [
      card({
        cardKey: "small",
        cardLabel: "Small",
        transactions: [txn({ amount: "10.00" as never })],
      }),
      card({
        cardKey: "big",
        cardLabel: "Big",
        transactions: [txn({ amount: "90.00" as never })],
      }),
    ];
    const rows = buildPerCardSummary(cards);
    expect(rows.map((r) => r.cardLabel)).toEqual(["Big", "Small"]);
    expect(rows[0].percentOfGrandTotal).toBeCloseTo(90, 5);
  });
});

describe("buildTopMerchantsOverall", () => {
  it("ranks merchants by spend across every card and truncates to limit", () => {
    const cards = [
      card({
        transactions: [
          txn({
            merchantId: "a",
            merchantDisplayName: "A",
            amount: "30.00" as never,
          }),
          txn({
            id: "t2",
            merchantId: "b",
            merchantDisplayName: "B",
            amount: "70.00" as never,
          }),
        ],
      }),
    ];
    const top = buildTopMerchantsOverall(cards, 1);
    expect(top).toHaveLength(1);
    expect(top[0].displayName).toBe("B");
    expect(top[0].percentOfGrandTotal).toBeCloseTo(70, 5);
  });
});

describe("buildLargestTransactions", () => {
  it("sorts by amount descending and resolves category/subcategory names", () => {
    const cards = [
      card({
        transactions: [
          txn({ id: "t1", amount: "10.00" as never }),
          txn({ id: "t2", amount: "500.00" as never }),
        ],
      }),
    ];
    const [largest] = buildLargestTransactions(cards, categoryName, 5);
    expect(largest.id).toBe("t2");
    expect(largest.categoryName).toBe("Shopping");
    expect(largest.subcategoryName).toBe("Clothing");
  });
});

describe("buildCombinedTransactionTable", () => {
  it("includes every transaction exactly once, sorted by date", () => {
    const cards = [
      card({ transactions: [txn({ id: "t1", date: "2026-08-15" })] }),
      card({
        cardKey: "Axis|Horizon|5678",
        transactions: [txn({ id: "t2", date: "2026-08-01" })],
      }),
    ];
    const rows = buildCombinedTransactionTable(cards, categoryName);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.date)).toEqual(["2026-08-01", "2026-08-15"]);
  });
});

describe("donutArcPath", () => {
  it("produces a well-formed path for a quarter slice", () => {
    const d = donutArcPath(50, 50, 40, 20, 0, 90);
    expect(d).toMatch(/^M .* A .* L .* A .* Z$/);
  });

  it("does not collapse a single 100%-slice (0deg to 360deg) into a zero-length path", () => {
    const d = donutArcPath(50, 50, 40, 20, 0, 360);
    // A full circle can't be swept by one SVG arc command -- confirm the
    // start/end angle got capped short of 360 rather than degenerating.
    expect(d).not.toContain("NaN");
    const match = /^M ([\d.-]+) ([\d.-]+) A/.exec(d);
    expect(match).not.toBeNull();
    const [, xStr, yStr] = match!;
    // The capped end angle (359.999°) should land very close to, but not
    // exactly at, the 0° start point -- i.e. not a zero-length arc.
    expect(Math.abs(Number(xStr) - 50)).toBeLessThan(1);
    expect(Math.abs(Number(yStr) - 10)).toBeLessThan(1);
  });
});

describe("buildLlmAnalysisPrompt", () => {
  it("interpolates real computed figures into the static prompt template", () => {
    const prompt = buildLlmAnalysisPrompt({
      cardCount: 6,
      cycleLabel: "2026-09",
      grandTotal: "12345.00" as never,
      transactionCount: 267,
      currency: "INR",
    });
    expect(prompt).toContain("6 cards'");
    expect(prompt).toContain("2026-09");
    expect(prompt).toContain("267 transactions");
    expect(prompt).toContain("12,345.00");
    expect(prompt).not.toContain("undefined");
  });

  it("uses singular 'card' for exactly one card", () => {
    const prompt = buildLlmAnalysisPrompt({
      cardCount: 1,
      cycleLabel: "2026-09",
      grandTotal: "100.00" as never,
      transactionCount: 3,
      currency: "USD",
    });
    expect(prompt).toContain("1 card'");
  });
});
