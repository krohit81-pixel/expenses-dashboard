import { describe, expect, it } from "vitest";

import { cycleMonthForStatementDate } from "./statement-cycle";

describe("cycleMonthForStatementDate", () => {
  it("tags a statement to the following calendar month", () => {
    expect(cycleMonthForStatementDate("2026-06-17")).toBe("2026-07");
  });

  it("carries over a year boundary", () => {
    expect(cycleMonthForStatementDate("2026-12-17")).toBe("2027-01");
  });

  it("only looks at the statement's own month, not the day it's dated", () => {
    expect(cycleMonthForStatementDate("2026-06-01")).toBe("2026-07");
    expect(cycleMonthForStatementDate("2026-06-30")).toBe("2026-07");
  });

  // v3.8.1 — looked like a bug, confirmed NOT one (see this file's own
  // header comment): ICICI's real due date lands only ~18 days after
  // generation, still inside the SAME calendar month (e.g. a statement
  // generated 12 Sep is due 30 Sep) — unlike HDFC/Axis, whose ~20-21
  // day term always spills into the next month. Checked directly with
  // the household: the rule is deliberately due-date-independent, so a
  // statement like this still tags to the FOLLOWING month regardless.
  // This test pins that down with the exact real numbers from the
  // statement that prompted the question, so a future "fix" attempt
  // has to deliberately override this, not stumble into it.
  it("still tags to the following month even when the real due date falls in the same month as generation (ICICI's real pattern)", () => {
    // Real statement: generated 2026-09-12, due 2026-09-30 -- the cycle
    // is still "2026-10", not "2026-09".
    expect(cycleMonthForStatementDate("2026-09-12")).toBe("2026-10");
  });
});
