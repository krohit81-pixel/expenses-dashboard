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
});
