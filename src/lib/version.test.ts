import { describe, expect, it } from "vitest";

import { getIndiaDateLabel } from "@/lib/version";

describe("getIndiaDateLabel", () => {
  it("formats today (IST) as dd-Mon-yyyy", () => {
    // 12:00 UTC = 17:30 IST, same calendar day either way.
    expect(getIndiaDateLabel(new Date("2026-07-18T12:00:00Z"))).toBe(
      "18-Jul-2026",
    );
  });

  it("pads a single-digit day", () => {
    expect(getIndiaDateLabel(new Date("2026-01-05T12:00:00Z"))).toBe(
      "05-Jan-2026",
    );
  });

  it("uses the India date, not the UTC date, near the day boundary", () => {
    // 19:00 UTC on the 18th is 00:30 IST on the 19th (UTC+5:30) — this
    // is exactly the bug class the old hardcoded-date approach and any
    // UTC/server-local computation would get wrong: the label needs to
    // read the 19th here, not the 18th.
    expect(getIndiaDateLabel(new Date("2026-07-18T19:00:00Z"))).toBe(
      "19-Jul-2026",
    );
  });

  it("carries the same India-vs-UTC day boundary correctly across a year boundary", () => {
    // 19:00 UTC on Dec 31 is 00:30 IST on Jan 1.
    expect(getIndiaDateLabel(new Date("2026-12-31T19:00:00Z"))).toBe(
      "01-Jan-2027",
    );
  });

  it("does not roll the India date forward before the boundary", () => {
    // 17:00 UTC on the 18th is still only 22:30 IST on the 18th.
    expect(getIndiaDateLabel(new Date("2026-07-18T17:00:00Z"))).toBe(
      "18-Jul-2026",
    );
  });
});
