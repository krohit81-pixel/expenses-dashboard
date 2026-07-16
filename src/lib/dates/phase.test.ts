import { describe, expect, it } from "vitest";

import { getCurrentPhase, getPhaseInfo } from "./phase";

function utcDate(year: number, month1Indexed: number, day: number): Date {
  return new Date(Date.UTC(year, month1Indexed - 1, day));
}

describe("getCurrentPhase — phase boundaries", () => {
  it("day 14 is tracking, day 15 is planning (the boundary)", () => {
    expect(getCurrentPhase(utcDate(2026, 7, 14)).phase).toBe("tracking");
    expect(getCurrentPhase(utcDate(2026, 7, 15)).phase).toBe("planning");
  });

  it("day 24 is planning, day 25 is execution (the boundary)", () => {
    expect(getCurrentPhase(utcDate(2026, 7, 24)).phase).toBe("planning");
    expect(getCurrentPhase(utcDate(2026, 7, 25)).phase).toBe("execution");
  });

  it("day 5 is execution, day 6 is tracking (the boundary)", () => {
    expect(getCurrentPhase(utcDate(2026, 7, 5)).phase).toBe("execution");
    expect(getCurrentPhase(utcDate(2026, 7, 6)).phase).toBe("tracking");
  });

  it("day 1 (still within Execution's wrapped window) is execution", () => {
    expect(getCurrentPhase(utcDate(2026, 7, 1)).phase).toBe("execution");
  });

  it("day 31 (last day of a 31-day month) is execution", () => {
    expect(getCurrentPhase(utcDate(2026, 7, 31)).phase).toBe("execution");
  });
});

describe("getCurrentPhase — Execution's spanning date range", () => {
  it("shows this month's 25th through next month's 5th when today is late in the month", () => {
    const info = getCurrentPhase(utcDate(2026, 7, 28));
    expect(info.dateRange).toBe("Jul 25 \u2013 Aug 5");
  });

  it("shows last month's 25th through this month's 5th when today is early in the month", () => {
    const info = getCurrentPhase(utcDate(2026, 8, 2));
    expect(info.dateRange).toBe("Jul 25 \u2013 Aug 5");
  });

  it("rolls over the calendar year correctly (December into January)", () => {
    const lateDecInfo = getCurrentPhase(utcDate(2026, 12, 27));
    expect(lateDecInfo.dateRange).toBe("Dec 25 \u2013 Jan 5");

    const earlyJanInfo = getCurrentPhase(utcDate(2027, 1, 3));
    expect(earlyJanInfo.dateRange).toBe("Dec 25 \u2013 Jan 5");
  });

  it("doesn't throw when February is involved (leap-year-adjacent month arithmetic)", () => {
    expect(() => getCurrentPhase(utcDate(2027, 2, 2))).not.toThrow();
    expect(() => getCurrentPhase(utcDate(2027, 1, 27))).not.toThrow();
  });
});

describe("getCurrentPhase — content", () => {
  it("returns the right label and question for each phase", () => {
    expect(getCurrentPhase(utcDate(2026, 7, 20))).toMatchObject({
      phase: "planning",
      label: "Planning phase",
      question: "Will next month be financially healthy?",
    });
    expect(getCurrentPhase(utcDate(2026, 7, 30))).toMatchObject({
      phase: "execution",
      label: "Execution phase",
      question: "What still needs to be completed?",
    });
    expect(getCurrentPhase(utcDate(2026, 7, 10))).toMatchObject({
      phase: "tracking",
      label: "Tracking phase",
      question: "Has anything changed my forecast?",
    });
  });

  it("Planning and Tracking ranges stay within a single month", () => {
    expect(getCurrentPhase(utcDate(2026, 7, 20)).dateRange).toBe(
      "Jul 15 \u2013 Jul 24",
    );
    expect(getCurrentPhase(utcDate(2026, 7, 10)).dateRange).toBe(
      "Jul 6 \u2013 Jul 14",
    );
  });
});

describe("getPhaseInfo — dates for a phase other than today's", () => {
  it("shows Planning's window for the current calendar month even while actually in Execution", () => {
    const info = getPhaseInfo("planning", utcDate(2026, 8, 2));
    expect(info.dateRange).toBe("Aug 15 \u2013 Aug 24");
  });

  it("shows Execution's window anchored to the current calendar month even while in Planning", () => {
    const info = getPhaseInfo("execution", utcDate(2026, 7, 18));
    expect(info.dateRange).toBe("Jul 25 \u2013 Aug 5");
  });

  it("matches getCurrentPhase's own range when asked for today's actual phase", () => {
    const today = utcDate(2026, 7, 20);
    expect(getPhaseInfo("planning", today).dateRange).toBe(
      getCurrentPhase(today).dateRange,
    );
  });
});
