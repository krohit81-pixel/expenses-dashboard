import { describe, expect, it, vi, beforeEach } from "vitest";

// server-only throws unconditionally outside a real Next.js build --
// same convention as BudgetSnapshotService.test.ts.
vi.mock("server-only", () => ({}));

const maybeSingleMock = vi.fn();
const eqMock = vi.fn(() => ({ eq: eqMock, maybeSingle: maybeSingleMock }));
const selectMock = vi.fn(() => ({ eq: eqMock }));
const upsertMock = vi.fn(
  async (): Promise<{ error: { message: string } | null }> => ({
    error: null,
  }),
);
const fromMock = vi.fn(() => ({ select: selectMock, upsert: upsertMock }));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: fromMock }),
}));
// @/lib/owner re-exports OWNER_USER_ID from serverEnv, which throws at
// import time outside a real Next.js build (see env/server.ts) — mock
// it directly so this file doesn't need the full server-env mock too.
vi.mock("@/lib/owner", () => ({
  OWNER_USER_ID: "550e8400-e29b-41d4-a716-446655440000",
}));

import {
  getCycleStartingBalance,
  setCycleStartingBalance,
} from "./CycleBalanceService";

beforeEach(() => {
  fromMock.mockClear();
  selectMock.mockClear();
  eqMock.mockClear();
  maybeSingleMock.mockReset();
  upsertMock.mockClear();
});

describe("getCycleStartingBalance", () => {
  it("returns null when no row exists for this cycle", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const result = await getCycleStartingBalance("2026-08");
    expect(result).toBeNull();
  });

  it("converts the stored numeric amount to a Money string", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { amount: 425000 },
      error: null,
    });
    const result = await getCycleStartingBalance("2026-08");
    expect(result).toBe("425000.00");
  });

  it("throws a clear error on a query failure", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    await expect(getCycleStartingBalance("2026-08")).rejects.toThrow(
      /Failed to load cycle starting balance/,
    );
  });
});

describe("setCycleStartingBalance", () => {
  it("upserts on (user_id, cycle_month)", async () => {
    await setCycleStartingBalance("2026-08", "425000.00" as never);
    expect(fromMock).toHaveBeenCalledWith("cycle_starting_balances");
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ cycle_month: "2026-08", amount: 425000 }),
      { onConflict: "user_id,cycle_month" },
    );
  });

  it("throws a clear error on a write failure", async () => {
    upsertMock.mockResolvedValueOnce({ error: { message: "boom" } });
    await expect(
      setCycleStartingBalance("2026-08", "1.00" as never),
    ).rejects.toThrow(/Failed to save cycle starting balance/);
  });
});
