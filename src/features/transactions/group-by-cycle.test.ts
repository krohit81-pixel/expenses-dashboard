import { describe, expect, it } from "vitest";

import { groupByCycleMonth } from "./group-by-cycle";

interface Fixture {
  id: string;
  cycleMonth: string | null;
}

describe("groupByCycleMonth", () => {
  it("groups items into buckets by cycleMonth", () => {
    const items: Fixture[] = [
      { id: "a", cycleMonth: "2026-07" },
      { id: "b", cycleMonth: "2026-08" },
      { id: "c", cycleMonth: "2026-07" },
    ];
    const groups = groupByCycleMonth(items);
    expect(groups).toHaveLength(2);
    expect(
      groups.find((g) => g.cycleMonth === "2026-07")?.items.map((i) => i.id),
    ).toEqual(["a", "c"]);
  });

  it("orders tagged groups most-recent-cycle-first", () => {
    const items: Fixture[] = [
      { id: "a", cycleMonth: "2026-06" },
      { id: "b", cycleMonth: "2026-09" },
      { id: "c", cycleMonth: "2026-07" },
    ];
    const groups = groupByCycleMonth(items);
    expect(groups.map((g) => g.cycleMonth)).toEqual([
      "2026-09",
      "2026-07",
      "2026-06",
    ]);
  });

  it("puts the untagged bucket last, even though it sorts first as a string", () => {
    const items: Fixture[] = [
      { id: "a", cycleMonth: null },
      { id: "b", cycleMonth: "2026-07" },
    ];
    const groups = groupByCycleMonth(items);
    expect(groups.map((g) => g.cycleMonth)).toEqual(["2026-07", null]);
    expect(groups[1].label).toBe("Untagged — not counted");
  });

  it("returns an empty array for no items", () => {
    expect(groupByCycleMonth([])).toEqual([]);
  });

  it("preserves each item's original relative order within its bucket", () => {
    const items: Fixture[] = [
      { id: "first", cycleMonth: "2026-07" },
      { id: "second", cycleMonth: "2026-07" },
      { id: "third", cycleMonth: "2026-07" },
    ];
    const groups = groupByCycleMonth(items);
    expect(groups[0].items.map((i) => i.id)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });
});
