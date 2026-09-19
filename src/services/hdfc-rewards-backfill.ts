import "server-only";

import type { Json } from "@/lib/db/database-types";
import type { createServiceClient } from "@/lib/supabase/service";
import type { RewardProgramLine } from "@/services/statement-parsers/hdfc-infinia-tata/types";

/**
 * v3.9.0 — a real, live example prompted this: the household's own
 * Infinia statement dated 2026-09-17 was imported before a parser bug
 * (v3.7.4) truncated bonus-points values were fixed, so its stored
 * `reward_points_summary` still reads the old, wrong numbers. Until
 * this, re-uploading the identical PDF hit saveHdfcStatement's
 * duplicate-detection branch and returned immediately, touching
 * nothing — there was no way to get a stale row corrected short of
 * manually editing the database.
 *
 * `backfillRewardsIfStale` is what a re-upload's duplicate branch now
 * calls: compare the fresh parse's reward-related fields against
 * what's already stored, and UPDATE only what's actually different —
 * never touching the transaction list itself (no inserts/deletes) or
 * any non-reward column. Written issuer-agnostically (plain
 * RewardProgramLine-shaped input, the one HDFC-specific type this
 * imports) so wiring Axis/ICICI's own duplicate branches in later is a
 * one-line addition — but only saveHdfcStatement calls it this
 * version; saveAxisStatement/saveIciciStatement keep today's plain
 * "duplicate, no changes" behavior.
 */

/**
 * Field-by-field comparison, deliberately NOT `JSON.stringify(a) ===
 * JSON.stringify(b)`: Postgres/JSONB doesn't guarantee an object's key
 * insertion order survives a round trip through storage, so two
 * logically-identical `{srNo, program, bonusPoints}` objects could
 * stringify differently depending on which one came fresh off the
 * parser and which one came back from the database. Sorting both by
 * `srNo` first also means the comparison doesn't care about row order,
 * only content.
 */
export function rewardSummariesDiffer(
  a: RewardProgramLine[],
  b: RewardProgramLine[],
): boolean {
  if (a.length !== b.length) return true;
  const bySrNo = (xs: RewardProgramLine[]) =>
    [...xs].sort((x, y) => x.srNo - y.srNo);
  const sortedA = bySrNo(a);
  const sortedB = bySrNo(b);
  return sortedA.some(
    (line, i) =>
      line.program !== sortedB[i].program ||
      line.bonusPoints !== sortedB[i].bonusPoints,
  );
}

export interface RewardsBackfillResult {
  backfilled: boolean;
}

interface FreshRewardsHeader {
  rewardPointsBalance: number;
  rewardPointsEarned: number;
  rewardPointsExpiring30Days: number;
  rewardPointsExpiring60Days: number;
  rewardPointsSummary: RewardProgramLine[];
}

interface FreshRewardsTransaction {
  sequenceNumber: number;
  rewardPoints: number | null;
}

/**
 * Only ever called on an already-detected duplicate (same
 * statement_hash+statement_date+card_last4) — the caller already knows
 * `existingStatementId` is this exact statement, re-parsed. Matches
 * transactions to their already-stored row via `sequenceNumber`, the
 * same column `unique (statement_id, sequence_number)` already
 * enforces as a stable per-statement identity (parsing identical PDF
 * text is deterministic, so this never risks matching the wrong row or
 * creating a duplicate one).
 */
export async function backfillRewardsIfStale(
  supabase: ReturnType<typeof createServiceClient>,
  existingStatementId: string,
  freshHeader: FreshRewardsHeader,
  freshTransactions: FreshRewardsTransaction[],
): Promise<RewardsBackfillResult> {
  let backfilled = false;

  const { data: existingStatement, error: statementError } = await supabase
    .from("credit_card_statements")
    .select(
      "reward_points_balance, reward_points_earned, reward_points_expiring_30_days, reward_points_expiring_60_days, reward_points_summary",
    )
    .eq("id", existingStatementId)
    .single();

  if (statementError || !existingStatement) {
    throw new Error(
      `Failed to load existing statement for rewards backfill: ${statementError?.message ?? "not found"}`,
    );
  }

  const summaryDiffers = rewardSummariesDiffer(
    freshHeader.rewardPointsSummary,
    existingStatement.reward_points_summary as unknown as RewardProgramLine[],
  );
  const scalarsDiffer =
    existingStatement.reward_points_balance !==
      freshHeader.rewardPointsBalance ||
    existingStatement.reward_points_earned !== freshHeader.rewardPointsEarned ||
    existingStatement.reward_points_expiring_30_days !==
      freshHeader.rewardPointsExpiring30Days ||
    existingStatement.reward_points_expiring_60_days !==
      freshHeader.rewardPointsExpiring60Days;

  if (summaryDiffers || scalarsDiffer) {
    const { error: updateError } = await supabase
      .from("credit_card_statements")
      .update({
        reward_points_balance: freshHeader.rewardPointsBalance,
        reward_points_earned: freshHeader.rewardPointsEarned,
        reward_points_expiring_30_days: freshHeader.rewardPointsExpiring30Days,
        reward_points_expiring_60_days: freshHeader.rewardPointsExpiring60Days,
        reward_points_summary:
          freshHeader.rewardPointsSummary as unknown as Json,
      })
      .eq("id", existingStatementId);
    if (updateError) {
      throw new Error(
        `Failed to backfill statement rewards: ${updateError.message}`,
      );
    }
    backfilled = true;
  }

  const { data: existingTransactions, error: transactionsError } =
    await supabase
      .from("credit_card_transactions")
      .select("id, sequence_number, reward_points")
      .eq("statement_id", existingStatementId);

  if (transactionsError) {
    throw new Error(
      `Failed to load existing transactions for rewards backfill: ${transactionsError.message}`,
    );
  }

  const freshBySequence = new Map(
    freshTransactions.map((t) => [t.sequenceNumber, t.rewardPoints]),
  );

  // Rare/small by design — only the handful of rows (if any) whose
  // points actually changed get an individual .update(), never a bulk
  // rewrite of every transaction on the statement.
  for (const row of existingTransactions) {
    const freshPoints = freshBySequence.get(row.sequence_number);
    if (freshPoints !== undefined && freshPoints !== row.reward_points) {
      const { error: rowError } = await supabase
        .from("credit_card_transactions")
        .update({ reward_points: freshPoints })
        .eq("id", row.id);
      if (rowError) {
        throw new Error(
          `Failed to backfill transaction reward points: ${rowError.message}`,
        );
      }
      backfilled = true;
    }
  }

  return { backfilled };
}
