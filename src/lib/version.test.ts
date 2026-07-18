import { describe, expect, it } from "vitest";

import { formatVersionDate } from "@/lib/version";

describe("formatVersionDate", () => {
  it("formats an ISO date as dd-Mon-yyyy", () => {
    expect(formatVersionDate("2026-07-18")).toBe("18-Jul-2026");
  });

  it("pads a single-digit day", () => {
    expect(formatVersionDate("2026-01-05")).toBe("05-Jan-2026");
  });

  it("doesn't drift a day across a year boundary", () => {
    expect(formatVersionDate("2025-12-31")).toBe("31-Dec-2025");
  });
});
