import { describe, expect, it } from "vitest";

import {
  createTransactionInputSchema,
  updateTransactionInputSchema,
} from "./schemas";

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_B = "22222222-2222-4222-8222-222222222222";
const CATEGORY_1 = "33333333-3333-4333-8333-333333333333";
const CATEGORY_2 = "44444444-4444-4444-8444-444444444444";

const base = {
  accountId: ACCOUNT_A,
  currencyCode: "USD",
  occurredOn: "2026-06-01",
};

describe("createTransactionInputSchema", () => {
  it("accepts a single-category expense", () => {
    const result = createTransactionInputSchema.safeParse({
      ...base,
      kind: "expense",
      amount: "42.50",
      categoryId: CATEGORY_1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a split expense whose splits sum to the total", () => {
    const result = createTransactionInputSchema.safeParse({
      ...base,
      kind: "expense",
      amount: "100.00",
      splits: [
        { categoryId: CATEGORY_1, amount: "60.00" },
        { categoryId: CATEGORY_2, amount: "40.00" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects splits that don't sum to the transaction amount", () => {
    const result = createTransactionInputSchema.safeParse({
      ...base,
      kind: "expense",
      amount: "100.00",
      splits: [
        { categoryId: CATEGORY_1, amount: "60.00" },
        { categoryId: CATEGORY_2, amount: "30.00" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a single split (use the single-category shape instead)", () => {
    const result = createTransactionInputSchema.safeParse({
      ...base,
      kind: "expense",
      amount: "50.00",
      splits: [{ categoryId: CATEGORY_1, amount: "50.00" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a transfer to a different account", () => {
    const result = createTransactionInputSchema.safeParse({
      ...base,
      kind: "transfer",
      amount: "500.00",
      transferAccountId: ACCOUNT_B,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a transfer to the same account", () => {
    const result = createTransactionInputSchema.safeParse({
      ...base,
      kind: "transfer",
      amount: "500.00",
      transferAccountId: ACCOUNT_A,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a zero or negative amount", () => {
    expect(
      createTransactionInputSchema.safeParse({
        ...base,
        kind: "expense",
        amount: "0.00",
        categoryId: CATEGORY_1,
      }).success,
    ).toBe(false);

    expect(
      createTransactionInputSchema.safeParse({
        ...base,
        kind: "expense",
        amount: "-10.00",
        categoryId: CATEGORY_1,
      }).success,
    ).toBe(false);
  });

  it("defaults status to pending, not posted — a new transaction shouldn't silently claim to already be paid", () => {
    const result = createTransactionInputSchema.safeParse({
      ...base,
      kind: "income",
      amount: "1000.00",
      categoryId: CATEGORY_1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("pending");
    }
  });

  it("accepts a valid cycleMonth", () => {
    const result = createTransactionInputSchema.safeParse({
      ...base,
      kind: "expense",
      amount: "50.00",
      categoryId: CATEGORY_1,
      cycleMonth: "2026-08",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an explicit null cycleMonth (leave untagged)", () => {
    const result = createTransactionInputSchema.safeParse({
      ...base,
      kind: "expense",
      amount: "50.00",
      categoryId: CATEGORY_1,
      cycleMonth: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cycleMonth).toBeNull();
    }
  });

  it("leaves cycleMonth undefined when omitted (service resolves the default)", () => {
    const result = createTransactionInputSchema.safeParse({
      ...base,
      kind: "expense",
      amount: "50.00",
      categoryId: CATEGORY_1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cycleMonth).toBeUndefined();
    }
  });

  it("rejects a malformed cycleMonth", () => {
    const result = createTransactionInputSchema.safeParse({
      ...base,
      kind: "expense",
      amount: "50.00",
      categoryId: CATEGORY_1,
      cycleMonth: "August 2026",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateTransactionInputSchema", () => {
  it("accepts an update without touching cycleMonth", () => {
    const result = updateTransactionInputSchema.safeParse({
      id: ACCOUNT_A,
      amount: "75.00",
      occurredOn: "2026-07-15",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cycleMonth).toBeUndefined();
    }
  });

  it("accepts explicitly clearing cycleMonth", () => {
    const result = updateTransactionInputSchema.safeParse({
      id: ACCOUNT_A,
      amount: "75.00",
      occurredOn: "2026-07-15",
      cycleMonth: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cycleMonth).toBeNull();
    }
  });

  it("accepts retagging to a different cycle", () => {
    const result = updateTransactionInputSchema.safeParse({
      id: ACCOUNT_A,
      amount: "75.00",
      occurredOn: "2026-07-15",
      cycleMonth: "2026-09",
    });
    expect(result.success).toBe(true);
  });
});
