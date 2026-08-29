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

/** A chainable, thenable stand-in for a real Supabase query builder — eq/in/order all just return the same builder, and awaiting it resolves whatever result the test set up for that table. */
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
    then: <T>(
      resolve: (value: { data: unknown[]; error: unknown }) => T,
    ) => Promise<T>;
  } = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
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

import { getLatestCycleTransactionsPerCard } from "./CreditCardIntelService";

function statement(overrides: Record<string, unknown> = {}) {
  return {
    id: "stmt-1",
    issuer: "HDFC",
    card_type: "Infinia",
    card_last4: "1234",
    statement_date: "2026-08-05",
    cycle_month: "2026-08",
    billing_period_start: "2026-07-06",
    billing_period_end: "2026-08-05",
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
