import { describe, expect, it, vi, beforeEach } from "vitest";

// server-only throws unconditionally outside a real Next.js build --
// same convention as MerchantMergeSuggestionService.test.ts /
// route.test.ts under app/api/cron/*.
vi.mock("server-only", () => ({}));

const listTransactionsMock = vi.fn();
vi.mock("@/services/TransactionService", () => ({
  listTransactions: (...args: unknown[]) => listTransactionsMock(...args),
}));

const listAccountsMock = vi.fn();
vi.mock("@/services/AccountService", () => ({
  listAccounts: (...args: unknown[]) => listAccountsMock(...args),
}));

import {
  getMonthlyBudgetSnapshot,
  getPlannedCardDuesForMonths,
} from "./BudgetSnapshotService";
import type { Transaction } from "@/services/TransactionService";
import type { Account } from "@/services/AccountService";

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: "acct-1",
    institutionId: null,
    name: "Checking",
    accountType: "checking",
    currencyCode: "INR",
    openingBalance: "0.00" as never,
    openingBalanceDate: null,
    isArchived: false,
    creditCard: null,
    ...overrides,
  };
}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "txn-1",
    accountId: "acct-1",
    transferAccountId: null,
    kind: "expense",
    status: "posted",
    amount: "1000.00" as never,
    currencyCode: "INR",
    occurredOn: "2026-08-05",
    payee: "Groceries",
    memo: null,
    recurringTransactionId: null,
    cycleMonth: "2026-08",
    splits: [],
    ...overrides,
  };
}

beforeEach(() => {
  listTransactionsMock.mockReset();
  listAccountsMock.mockReset();
  listAccountsMock.mockResolvedValue([
    account({ id: "acct-checking", accountType: "checking" }),
    account({ id: "acct-card", accountType: "credit_card" }),
  ]);
});

describe("getMonthlyBudgetSnapshot", () => {
  it("returns a flat, empty snapshot when nothing is tagged", async () => {
    listTransactionsMock.mockResolvedValue({ transactions: [], total: 0 });

    const snapshot = await getMonthlyBudgetSnapshot("2026-08");

    expect(snapshot).toEqual({
      month: "2026-08",
      lines: [],
      incomeTotal: "0.00",
      expenseTotal: "0.00",
    });
  });

  it("excludes voided transactions", async () => {
    listTransactionsMock.mockResolvedValue({
      transactions: [
        transaction({
          id: "voided",
          status: "void",
          amount: "500.00" as never,
        }),
      ],
      total: 1,
    });

    const snapshot = await getMonthlyBudgetSnapshot("2026-08");

    expect(snapshot.lines).toHaveLength(0);
    expect(snapshot.expenseTotal).toBe("0.00");
  });

  it("buckets income and expense lines and sums each total independently", async () => {
    listTransactionsMock.mockResolvedValue({
      transactions: [
        transaction({
          id: "salary",
          kind: "income",
          amount: "100000.00" as never,
          payee: "Salary",
        }),
        transaction({
          id: "rent",
          kind: "expense",
          amount: "30000.00" as never,
          payee: "Rent",
        }),
        transaction({
          id: "groceries",
          kind: "expense",
          amount: "5000.00" as never,
          payee: "Groceries",
        }),
      ],
      total: 3,
    });

    const snapshot = await getMonthlyBudgetSnapshot("2026-08");

    expect(snapshot.lines).toHaveLength(3);
    expect(snapshot.incomeTotal).toBe("100000.00");
    expect(snapshot.expenseTotal).toBe("35000.00");
  });

  it("marks a transfer to a non-spendable account (a card) as reducing cash on hand", async () => {
    listTransactionsMock.mockResolvedValue({
      transactions: [
        transaction({
          id: "card-payment",
          kind: "transfer",
          amount: "20000.00" as never,
          payee: "Card statement",
          transferAccountId: "acct-card",
        }),
      ],
      total: 1,
    });

    const snapshot = await getMonthlyBudgetSnapshot("2026-08");

    expect(snapshot.lines[0].transferReducesCashOnHand).toBe(true);
  });

  it("marks a transfer between two spendable accounts as NOT reducing cash on hand", async () => {
    listTransactionsMock.mockResolvedValue({
      transactions: [
        transaction({
          id: "self-transfer",
          kind: "transfer",
          amount: "10000.00" as never,
          payee: "Self",
          transferAccountId: "acct-checking",
        }),
      ],
      total: 1,
    });

    const snapshot = await getMonthlyBudgetSnapshot("2026-08");

    expect(snapshot.lines[0].transferReducesCashOnHand).toBe(false);
  });

  it("fetches accounts with includeArchived: true, so a transfer to an archived account is still classified correctly", async () => {
    listTransactionsMock.mockResolvedValue({ transactions: [], total: 0 });

    await getMonthlyBudgetSnapshot("2026-08");

    expect(listAccountsMock).toHaveBeenCalledWith(true);
  });

  it("scopes the transaction fetch to the requested cycle month", async () => {
    listTransactionsMock.mockResolvedValue({ transactions: [], total: 0 });

    await getMonthlyBudgetSnapshot("2026-09");

    expect(listTransactionsMock).toHaveBeenCalledWith(
      expect.objectContaining({ cycleMonth: "2026-09" }),
    );
  });
});

describe("getPlannedCardDuesForMonths", () => {
  it("returns a Map keyed by month, zeroed for a month with no card-paydown transfer", async () => {
    listTransactionsMock.mockImplementation(
      async ({ cycleMonth }: { cycleMonth: string }) => {
        if (cycleMonth === "2026-08") {
          return {
            transactions: [
              transaction({
                id: "aug-card",
                kind: "transfer",
                amount: "15000.00" as never,
                transferAccountId: "acct-card",
              }),
            ],
            total: 1,
          };
        }
        return { transactions: [], total: 0 };
      },
    );

    const result = await getPlannedCardDuesForMonths(["2026-08", "2026-09"]);

    expect(result.get("2026-08")).toBe("15000.00");
    expect(result.get("2026-09")).toBe("0.00");
  });
});
