import { describe, expect, it, vi } from "vitest";

// server-only throws unconditionally outside a real Next.js build --
// same convention as this codebase's other service test files.
vi.mock("server-only", () => ({}));

import {
  rewardSummariesDiffer,
  backfillRewardsIfStale,
} from "./hdfc-rewards-backfill";

describe("rewardSummariesDiffer", () => {
  it("returns false for identical content, regardless of object key order", () => {
    const a = [{ srNo: 1, program: "FCYConversion", bonusPoints: 1 }];
    // Same values, different literal key order -- a naive
    // JSON.stringify comparison would see these as different strings.
    const b = [{ bonusPoints: 1, program: "FCYConversion", srNo: 1 }];
    expect(rewardSummariesDiffer(a, b)).toBe(false);
  });

  it("returns true for the real bug this was built to catch (116 vs 1165)", () => {
    const stale = [
      { srNo: 2, program: "Reward Points_on_Grocery", bonusPoints: 116 },
    ];
    const fresh = [
      { srNo: 2, program: "Reward Points_on_Grocery", bonusPoints: 1165 },
    ];
    expect(rewardSummariesDiffer(fresh, stale)).toBe(true);
  });

  it("returns true when the number of programs differs", () => {
    const a = [{ srNo: 1, program: "A", bonusPoints: 1 }];
    const b = [
      { srNo: 1, program: "A", bonusPoints: 1 },
      { srNo: 2, program: "B", bonusPoints: 2 },
    ];
    expect(rewardSummariesDiffer(a, b)).toBe(true);
  });

  it("returns false for the same content in a different row order", () => {
    const a = [
      { srNo: 1, program: "A", bonusPoints: 1 },
      { srNo: 2, program: "B", bonusPoints: 2 },
    ];
    const b = [
      { srNo: 2, program: "B", bonusPoints: 2 },
      { srNo: 1, program: "A", bonusPoints: 1 },
    ];
    expect(rewardSummariesDiffer(a, b)).toBe(false);
  });

  it("returns true when a program name differs even if points match", () => {
    const a = [
      { srNo: 1, program: "SmartBuy_Aug26_Bonus_5X", bonusPoints: 100 },
    ];
    const b = [
      { srNo: 1, program: "SmartBuy_Sep26_Bonus_5X", bonusPoints: 100 },
    ];
    expect(rewardSummariesDiffer(a, b)).toBe(true);
  });
});

/**
 * A hand-built fake rather than a mocked module: backfillRewardsIfStale
 * takes its Supabase client as a plain parameter (not imported), so a
 * purpose-built fake matching only the exact chain calls it makes is
 * simpler and more explicit than mocking @/lib/supabase/service. Update
 * calls are captured directly (payload + target id) rather than via
 * vi.fn() mock-call introspection.
 */
function makeSupabaseMock(opts: {
  existingStatement: {
    reward_points_balance: number;
    reward_points_earned: number;
    reward_points_expiring_30_days: number;
    reward_points_expiring_60_days: number;
    reward_points_summary: unknown;
  };
  existingTransactions: {
    id: string;
    sequence_number: number;
    reward_points: number | null;
  }[];
}) {
  const statementUpdateCalls: { payload: unknown }[] = [];
  const transactionUpdateCalls: { payload: unknown; id: string }[] = [];

  const supabase = {
    from: (table: string) => {
      if (table === "credit_card_statements") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({ data: opts.existingStatement, error: null }),
            }),
          }),
          update: (payload: unknown) => {
            statementUpdateCalls.push({ payload });
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      }
      if (table === "credit_card_transactions") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: opts.existingTransactions,
                error: null,
              }),
          }),
          update: (payload: unknown) => ({
            eq: (_column: string, id: string) => {
              transactionUpdateCalls.push({ payload, id });
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return { supabase, statementUpdateCalls, transactionUpdateCalls };
}

const unchangedHeader = {
  rewardPointsBalance: 74490,
  rewardPointsEarned: 35621,
  rewardPointsExpiring30Days: 0,
  rewardPointsExpiring60Days: 0,
  rewardPointsSummary: [
    { srNo: 1, program: "FCYConversion", bonusPoints: 1 },
    { srNo: 2, program: "Reward Points_on_Grocery", bonusPoints: 1165 },
  ],
};

describe("backfillRewardsIfStale", () => {
  it("backfills nothing and reports backfilled: false when everything already matches", async () => {
    const { supabase, statementUpdateCalls, transactionUpdateCalls } =
      makeSupabaseMock({
        existingStatement: {
          reward_points_balance: unchangedHeader.rewardPointsBalance,
          reward_points_earned: unchangedHeader.rewardPointsEarned,
          reward_points_expiring_30_days:
            unchangedHeader.rewardPointsExpiring30Days,
          reward_points_expiring_60_days:
            unchangedHeader.rewardPointsExpiring60Days,
          reward_points_summary: unchangedHeader.rewardPointsSummary,
        },
        existingTransactions: [
          { id: "t1", sequence_number: 1, reward_points: 105 },
        ],
      });

    const result = await backfillRewardsIfStale(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      "stmt-1",
      unchangedHeader,
      [{ sequenceNumber: 1, rewardPoints: 105 }],
    );

    expect(result.backfilled).toBe(false);
    expect(statementUpdateCalls).toHaveLength(0);
    expect(transactionUpdateCalls).toHaveLength(0);
  });

  it("updates only the statement row when its reward_points_summary is stale (the real 116-vs-1165 case)", async () => {
    const { supabase, statementUpdateCalls, transactionUpdateCalls } =
      makeSupabaseMock({
        existingStatement: {
          reward_points_balance: unchangedHeader.rewardPointsBalance,
          reward_points_earned: unchangedHeader.rewardPointsEarned,
          reward_points_expiring_30_days: 0,
          reward_points_expiring_60_days: 0,
          reward_points_summary: [
            { srNo: 1, program: "FCYConversion", bonusPoints: 1 },
            // Stale -- should be 1165.
            { srNo: 2, program: "Reward Points_on_Grocery", bonusPoints: 116 },
          ],
        },
        existingTransactions: [
          { id: "t1", sequence_number: 1, reward_points: 105 },
        ],
      });

    const result = await backfillRewardsIfStale(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      "stmt-1",
      unchangedHeader,
      [{ sequenceNumber: 1, rewardPoints: 105 }],
    );

    expect(result.backfilled).toBe(true);
    expect(statementUpdateCalls).toHaveLength(1);
    expect(statementUpdateCalls[0].payload).toMatchObject({
      reward_points_summary: unchangedHeader.rewardPointsSummary,
    });
    expect(transactionUpdateCalls).toHaveLength(0);
  });

  it("updates only the differing transaction rows, by their own id, leaving matching rows untouched", async () => {
    const { supabase, statementUpdateCalls, transactionUpdateCalls } =
      makeSupabaseMock({
        existingStatement: {
          reward_points_balance: unchangedHeader.rewardPointsBalance,
          reward_points_earned: unchangedHeader.rewardPointsEarned,
          reward_points_expiring_30_days:
            unchangedHeader.rewardPointsExpiring30Days,
          reward_points_expiring_60_days:
            unchangedHeader.rewardPointsExpiring60Days,
          reward_points_summary: unchangedHeader.rewardPointsSummary,
        },
        existingTransactions: [
          { id: "t1", sequence_number: 1, reward_points: null }, // stale -- fresh parse has 330
          { id: "t2", sequence_number: 2, reward_points: 65 }, // already correct
        ],
      });

    const result = await backfillRewardsIfStale(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      "stmt-1",
      unchangedHeader,
      [
        { sequenceNumber: 1, rewardPoints: 330 },
        { sequenceNumber: 2, rewardPoints: 65 },
      ],
    );

    expect(result.backfilled).toBe(true);
    expect(statementUpdateCalls).toHaveLength(0);
    expect(transactionUpdateCalls).toHaveLength(1);
    expect(transactionUpdateCalls[0]).toEqual({
      id: "t1",
      payload: { reward_points: 330 },
    });
  });

  it("backfills both the statement and specific transactions in one pass when both are stale", async () => {
    const { supabase, statementUpdateCalls, transactionUpdateCalls } =
      makeSupabaseMock({
        existingStatement: {
          reward_points_balance: unchangedHeader.rewardPointsBalance,
          reward_points_earned: 30000, // stale -- fresh says 35621
          reward_points_expiring_30_days: 0,
          reward_points_expiring_60_days: 0,
          reward_points_summary: unchangedHeader.rewardPointsSummary,
        },
        existingTransactions: [
          { id: "t1", sequence_number: 1, reward_points: null },
        ],
      });

    const result = await backfillRewardsIfStale(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      "stmt-1",
      unchangedHeader,
      [{ sequenceNumber: 1, rewardPoints: 105 }],
    );

    expect(result.backfilled).toBe(true);
    expect(statementUpdateCalls).toHaveLength(1);
    expect(transactionUpdateCalls).toHaveLength(1);
  });

  it("never touches a transaction whose sequence number isn't present in the fresh parse", async () => {
    // Defensive case: the existing row's sequence_number has no match
    // in freshTransactions at all (shouldn't happen in practice, since
    // re-parsing identical text is deterministic, but the function
    // must not crash or wrongly "correct" it to undefined).
    const { supabase, transactionUpdateCalls } = makeSupabaseMock({
      existingStatement: {
        reward_points_balance: unchangedHeader.rewardPointsBalance,
        reward_points_earned: unchangedHeader.rewardPointsEarned,
        reward_points_expiring_30_days:
          unchangedHeader.rewardPointsExpiring30Days,
        reward_points_expiring_60_days:
          unchangedHeader.rewardPointsExpiring60Days,
        reward_points_summary: unchangedHeader.rewardPointsSummary,
      },
      existingTransactions: [
        { id: "t1", sequence_number: 99, reward_points: 50 },
      ],
    });

    const result = await backfillRewardsIfStale(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      "stmt-1",
      unchangedHeader,
      [{ sequenceNumber: 1, rewardPoints: 105 }],
    );

    expect(result.backfilled).toBe(false);
    expect(transactionUpdateCalls).toHaveLength(0);
  });
});
