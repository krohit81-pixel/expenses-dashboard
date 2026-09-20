import { describe, expect, it, vi, beforeEach } from "vitest";

// server-only throws unconditionally outside a real Next.js build --
// same convention as BudgetSnapshotService.test.ts.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/owner", () => ({
  OWNER_USER_ID: "550e8400-e29b-41d4-a716-446655440000",
}));

let statementsResult: { data: unknown[]; error: { message: string } | null } = {
  data: [],
  error: null,
};
let transactionsResult: {
  data: unknown[];
  error: { message: string } | null;
} = { data: [], error: null };

/**
 * A chainable, thenable stand-in for a real Supabase query builder --
 * eq/in/order/limit/not all just return the same builder, and awaiting
 * it resolves whatever result the test set up for that table.
 *
 * v3.9.0 -- gained limit/not (plain passthroughs, same as eq/in/order)
 * and maybeSingle (a real terminal call, like the actual Supabase
 * client's own: resolves the first row or null instead of the whole
 * array) for getLatestCardRewardsSummary's single-statement lookup.
 */
function makeBuilder(
  getResult: () => {
    data: unknown[];
    error: { message: string } | null;
  },
) {
  const builder: {
    select: () => typeof builder;
    eq: () => typeof builder;
    in: () => typeof builder;
    order: () => typeof builder;
    limit: () => typeof builder;
    not: () => typeof builder;
    maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
    then: <T>(
      resolve: (value: { data: unknown[]; error: unknown }) => T,
    ) => Promise<T>;
  } = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    not: () => builder,
    maybeSingle: () => {
      const result = getResult();
      return Promise.resolve({
        data: result.data[0] ?? null,
        error: result.error,
      });
    },
    then: (resolve) => Promise.resolve(getResult()).then(resolve),
  };
  return builder;
}

const fromMock = vi.fn((table: string) => {
  if (table === "credit_card_statements") {
    return makeBuilder(() => statementsResult);
  }
  if (table === "credit_card_transactions") {
    return makeBuilder(() => transactionsResult);
  }
  throw new Error(`Unexpected table: ${table}`);
});

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: fromMock }),
}));

import {
  getLatestCycleTransactionsPerCard,
  getLatestCycleReportData,
  getLatestCardRewardsSummary,
  getLatestCardPointsBalance,
} from "./CreditCardIntelService";

function statement(overrides: Record<string, unknown> = {}) {
  return {
    id: "stmt-1",
    issuer: "HDFC",
    card_type: "Infinia",
    card_last4: "1234",
    primary_cardholder: "Rohit",
    statement_date: "2026-08-05",
    cycle_month: "2026-08",
    billing_period_start: "2026-07-06",
    billing_period_end: "2026-08-05",
    due_date: "2026-08-25",
    total_amount_due: 45000,
    minimum_due: 4500,
    previous_statement_due: 0,
    payments_received: 0,
    purchases_debit: 45000,
    finance_charges: 0,
    available_credit_limit: 55000,
    total_credit_limit: 100000,
    ...overrides,
  };
}

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    statement_id: "stmt-1",
    transaction_date: "2026-07-15",
    description: "RAW DESCRIPTION",
    amount: 1000,
    currency: "INR",
    merchants: null,
    ...overrides,
  };
}

beforeEach(() => {
  fromMock.mockClear();
  statementsResult = { data: [], error: null };
  transactionsResult = { data: [], error: null };
});

describe("getLatestCycleTransactionsPerCard", () => {
  it("returns an empty array when no statements exist", async () => {
    const result = await getLatestCycleTransactionsPerCard();
    expect(result).toEqual([]);
    // Should short-circuit before ever querying transactions.
    expect(fromMock).toHaveBeenCalledWith("credit_card_statements");
    expect(fromMock).not.toHaveBeenCalledWith("credit_card_transactions");
  });

  it("throws a clear error when the statements query fails", async () => {
    statementsResult = { data: [], error: { message: "boom" } };
    await expect(getLatestCycleTransactionsPerCard()).rejects.toThrow(
      /Failed to load credit card statements/,
    );
  });

  it("picks only the newest statement per distinct card (issuer/card_type/card_last4)", async () => {
    statementsResult = {
      data: [
        // Newest-first, matching real query ordering — the function
        // trusts the DB's own order() and just keeps the first row
        // seen per card key.
        statement({ id: "stmt-newer", statement_date: "2026-08-05" }),
        statement({ id: "stmt-older", statement_date: "2026-07-05" }),
      ],
      error: null,
    };
    transactionsResult = { data: [], error: null };

    const result = await getLatestCycleTransactionsPerCard();

    expect(result).toHaveLength(1);
    expect(result[0].cycleMonth).toBe("2026-08");
  });

  it("keeps one entry per distinct card when multiple different cards exist", async () => {
    statementsResult = {
      data: [
        statement({
          id: "stmt-hdfc",
          issuer: "HDFC",
          card_type: "Infinia",
          card_last4: "1234",
        }),
        statement({
          id: "stmt-axis",
          issuer: "Axis",
          card_type: "Horizon",
          card_last4: "5678",
        }),
      ],
      error: null,
    };

    const result = await getLatestCycleTransactionsPerCard();

    expect(result).toHaveLength(2);
    expect(result.map((c) => c.cardLabel)).toEqual([
      "HDFC Infinia •••• 1234",
      "Axis Horizon •••• 5678",
    ]);
  });

  it("throws a clear error when the transactions query fails", async () => {
    statementsResult = { data: [statement()], error: null };
    transactionsResult = { data: [], error: { message: "boom" } };
    await expect(getLatestCycleTransactionsPerCard()).rejects.toThrow(
      /Failed to load credit card transactions/,
    );
  });

  it("groups transactions under their own statement and prefers the tagged merchant name over the raw description", async () => {
    statementsResult = { data: [statement({ id: "stmt-1" })], error: null };
    transactionsResult = {
      data: [
        transaction({
          statement_id: "stmt-1",
          description: "AMZN*ORDER 12345",
          merchants: { display_name: "Amazon" },
          amount: 2500,
        }),
        transaction({
          statement_id: "stmt-1",
          description: "SOME RAW MERCHANT",
          merchants: null,
          amount: 500,
        }),
        transaction({
          // Grouped under its own statement id (a real query would
          // never return this row at all, since it's not one of the
          // requested statement ids — this fixture stands in for that
          // by proving the function's own grouping never surfaces it:
          // only statement ids present in `latestStatements` are ever
          // read back out of the per-statement map).
          statement_id: "stmt-not-latest",
          description: "SHOULD NOT APPEAR",
        }),
      ],
      error: null,
    };

    const result = await getLatestCycleTransactionsPerCard();

    expect(result).toHaveLength(1);
    expect(result[0].transactions).toHaveLength(2);
    expect(result[0].transactions[0].description).toBe("Amazon");
    expect(result[0].transactions[0].amount).toBe("2500.00");
    expect(result[0].transactions[1].description).toBe("SOME RAW MERCHANT");
  });

  it("gives a card with a latest statement but zero transactions an empty list, not an error", async () => {
    statementsResult = { data: [statement()], error: null };
    transactionsResult = { data: [], error: null };

    const result = await getLatestCycleTransactionsPerCard();

    expect(result).toHaveLength(1);
    expect(result[0].transactions).toEqual([]);
  });
});

describe("getLatestCycleReportData", () => {
  it("returns an empty array when no statements exist", async () => {
    const result = await getLatestCycleReportData();
    expect(result).toEqual([]);
    expect(fromMock).not.toHaveBeenCalledWith("credit_card_transactions");
  });

  it("picks the newest statement per card, same grouping as getLatestCycleTransactionsPerCard", async () => {
    statementsResult = {
      data: [
        statement({ id: "stmt-newer", statement_date: "2026-08-05" }),
        statement({ id: "stmt-older", statement_date: "2026-07-05" }),
      ],
      error: null,
    };

    const result = await getLatestCycleReportData();

    expect(result).toHaveLength(1);
    expect(result[0].statementDate).toBe("2026-08-05");
    expect(result[0].cardKey).toBe("HDFC|Infinia|1234");
  });

  it("carries statement header facts as Money", async () => {
    statementsResult = { data: [statement()], error: null };

    const result = await getLatestCycleReportData();

    expect(result[0].totalAmountDue).toBe("45000.00");
    expect(result[0].minimumDue).toBe("4500.00");
    expect(result[0].availableCreditLimit).toBe("55000.00");
    expect(result[0].totalCreditLimit).toBe("100000.00");
    expect(result[0].dueDate).toBe("2026-08-25");
  });

  it("resolves a transaction's merchant, category, and subcategory when tagged", async () => {
    statementsResult = { data: [statement({ id: "stmt-1" })], error: null };
    transactionsResult = {
      data: [
        transaction({
          id: "txn-1",
          statement_id: "stmt-1",
          description: "RAYMOND STORE",
          merchants: {
            id: "merch-1",
            display_name: "Raymond",
            atlas_category_id: "cat-shopping",
            atlas_subcategory_id: "cat-clothing",
          },
        }),
      ],
      error: null,
    };

    const result = await getLatestCycleReportData();

    expect(result[0].transactions).toHaveLength(1);
    const txn = result[0].transactions[0];
    expect(txn.description).toBe("Raymond");
    expect(txn.merchantId).toBe("merch-1");
    expect(txn.merchantDisplayName).toBe("Raymond");
    expect(txn.atlasCategoryId).toBe("cat-shopping");
    expect(txn.atlasSubcategoryId).toBe("cat-clothing");
  });

  it("leaves merchant/category fields null and falls back to the raw description when untagged", async () => {
    statementsResult = { data: [statement({ id: "stmt-1" })], error: null };
    transactionsResult = {
      data: [
        transaction({
          id: "txn-2",
          statement_id: "stmt-1",
          description: "UNKNOWN VENDOR 123",
          merchants: null,
        }),
      ],
      error: null,
    };

    const result = await getLatestCycleReportData();

    const txn = result[0].transactions[0];
    expect(txn.description).toBe("UNKNOWN VENDOR 123");
    expect(txn.merchantId).toBeNull();
    expect(txn.merchantDisplayName).toBeNull();
    expect(txn.atlasCategoryId).toBeNull();
    expect(txn.atlasSubcategoryId).toBeNull();
  });

  it("throws a clear error when the transactions query fails", async () => {
    statementsResult = { data: [statement()], error: null };
    transactionsResult = { data: [], error: { message: "boom" } };
    await expect(getLatestCycleReportData()).rejects.toThrow(
      /Failed to load credit card transactions/,
    );
  });
});

describe("getLatestCardRewardsSummary", () => {
  it("returns null when no statement exists for this card yet", async () => {
    statementsResult = { data: [], error: null };
    const result = await getLatestCardRewardsSummary("HDFC", "Infinia");
    expect(result).toBeNull();
    // Should short-circuit before ever querying transactions.
    expect(fromMock).toHaveBeenCalledWith("credit_card_statements");
    expect(fromMock).not.toHaveBeenCalledWith("credit_card_transactions");
  });

  it("throws a clear error when the statement lookup fails", async () => {
    statementsResult = { data: [], error: { message: "boom" } };
    await expect(
      getLatestCardRewardsSummary("HDFC", "Infinia"),
    ).rejects.toThrow(/Failed to load latest HDFC Infinia statement/);
  });

  it("returns an empty top-transactions list and a zero base total when nothing earned points this cycle", async () => {
    statementsResult = {
      data: [
        statement({
          reward_points_earned: 0,
          reward_points_summary: [],
        }),
      ],
      error: null,
    };
    transactionsResult = { data: [], error: null };

    const result = await getLatestCardRewardsSummary("HDFC", "Infinia");

    expect(result).not.toBeNull();
    expect(result!.topTransactions).toEqual([]);
    expect(result!.basePointsTotal).toBe(0);
  });

  it("throws a clear error when the transactions query fails", async () => {
    statementsResult = { data: [statement()], error: null };
    transactionsResult = { data: [], error: { message: "boom" } };
    await expect(
      getLatestCardRewardsSummary("HDFC", "Infinia"),
    ).rejects.toThrow(/Failed to load reward transactions/);
  });

  it("slices to the top 5 by reward points and sums every reward-bearing transaction for the base total", async () => {
    statementsResult = {
      data: [
        statement({
          reward_points_earned: 35621,
          reward_points_summary: [
            { srNo: 1, program: "FCYConversion", bonusPoints: 1 },
            {
              srNo: 2,
              program: "Reward Points_on_Grocery",
              bonusPoints: 1165,
            },
          ],
        }),
      ],
      error: null,
    };
    // 6 reward-bearing transactions, pre-sorted desc the way the real
    // query's own .order("reward_points", {ascending: false}) would --
    // the function trusts that ordering rather than re-sorting itself.
    transactionsResult = {
      data: [
        transaction({ id: "t1", reward_points: 27180, amount: 815518 }),
        transaction({ id: "t2", reward_points: 790, amount: 23848 }),
        transaction({ id: "t3", reward_points: 675, amount: 20380 }),
        transaction({ id: "t4", reward_points: 440, amount: 13332 }),
        transaction({ id: "t5", reward_points: 330, amount: 10000 }),
        transaction({ id: "t6", reward_points: 105, amount: 3219 }),
      ],
      error: null,
    };

    const result = await getLatestCardRewardsSummary("HDFC", "Infinia");

    expect(result!.topTransactions).toHaveLength(5);
    expect(result!.topTransactions.map((t) => t.id)).toEqual([
      "t1",
      "t2",
      "t3",
      "t4",
      "t5",
    ]);
    expect(result!.topTransactions[0].rewardPoints).toBe(27180);
    // t6 (105) is excluded from the top-5 slice but still counted here.
    expect(result!.basePointsTotal).toBe(27180 + 790 + 675 + 440 + 330 + 105);
    expect(result!.rewardPointsEarned).toBe(35621);
    expect(result!.rewardPointsSummary).toHaveLength(2);
  });

  it("prefers the merchant's own display name over the raw description", async () => {
    statementsResult = { data: [statement()], error: null };
    transactionsResult = {
      data: [
        transaction({
          id: "t1",
          reward_points: 50,
          description: "RAW DESCRIPTION",
          merchants: { display_name: "Nicely Named Merchant" },
        }),
      ],
      error: null,
    };

    const result = await getLatestCardRewardsSummary("HDFC", "Infinia");

    expect(result!.topTransactions[0].description).toBe(
      "Nicely Named Merchant",
    );
  });
});

describe("getLatestCardPointsBalance", () => {
  it("returns null when no statement exists for this card yet", async () => {
    statementsResult = { data: [], error: null };
    const result = await getLatestCardPointsBalance("AXIS", "horizon");
    expect(result).toBeNull();
    // Should never touch credit_card_transactions -- this card has no
    // per-transaction points to look up.
    expect(fromMock).not.toHaveBeenCalledWith("credit_card_transactions");
  });

  it("throws a clear error when the statement lookup fails", async () => {
    statementsResult = { data: [], error: { message: "boom" } };
    await expect(getLatestCardPointsBalance("AXIS", "horizon")).rejects.toThrow(
      /Failed to load latest AXIS horizon statement/,
    );
  });

  it("returns the statement's own running points balance", async () => {
    statementsResult = {
      data: [
        statement({
          issuer: "AXIS",
          card_type: "horizon",
          statement_date: "2026-09-18",
          reward_points_balance: 29035,
        }),
      ],
      error: null,
    };
    const result = await getLatestCardPointsBalance("AXIS", "horizon");
    expect(result).toEqual({
      statementDate: "2026-09-18",
      rewardPointsBalance: 29035,
    });
  });
});
