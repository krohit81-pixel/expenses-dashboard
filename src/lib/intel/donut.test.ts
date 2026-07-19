import { describe, expect, it } from "vitest";

import { buildDonutGradientStops, buildDonutSlices } from "./donut";
import type { CategoryBreakdown } from "@/services/ReportingService";

describe("buildDonutSlices", () => {
  it("returns an empty array for no categories", () => {
    expect(buildDonutSlices([], new Map())).toEqual([]);
  });

  it("keeps up to 5 categories as-is, sorted largest first", () => {
    const categories: CategoryBreakdown[] = [
      { categoryId: "a", total: "100.00" as never },
      { categoryId: "b", total: "500.00" as never },
      { categoryId: "c", total: "300.00" as never },
    ];
    const names = new Map([
      ["a", "Groceries"],
      ["b", "Rent"],
      ["c", "Dining"],
    ]);
    expect(buildDonutSlices(categories, names)).toEqual([
      { name: "Rent", total: "500.00" },
      { name: "Dining", total: "300.00" },
      { name: "Groceries", total: "100.00" },
    ]);
  });

  it("buckets everything past the top 5 into Other", () => {
    const categories: CategoryBreakdown[] = Array.from(
      { length: 7 },
      (_, i) => ({
        categoryId: `c${i}`,
        total: `${(7 - i) * 100}.00` as never,
      }),
    );
    const names = new Map(categories.map((c) => [c.categoryId, c.categoryId]));
    const slices = buildDonutSlices(categories, names);
    expect(slices).toHaveLength(6);
    expect(slices[5]).toEqual({ name: "Other", total: "300.00" });
  });

  it("falls back to Uncategorized when a category id has no name", () => {
    const categories: CategoryBreakdown[] = [
      { categoryId: "missing", total: "50.00" as never },
    ];
    expect(buildDonutSlices(categories, new Map())).toEqual([
      { name: "Uncategorized", total: "50.00" },
    ]);
  });
});

describe("buildDonutGradientStops", () => {
  it("returns no stops for no slices", () => {
    expect(buildDonutGradientStops([], "0.00" as never, ["red"])).toEqual([]);
  });

  it("splits the circle proportionally across slices", () => {
    const slices = [
      { name: "A", total: "75.00" as never },
      { name: "B", total: "25.00" as never },
    ];
    const stops = buildDonutGradientStops(slices, "100.00" as never, [
      "red",
      "blue",
    ]);
    expect(stops).toEqual(["red 0% 75%", "blue 75% 100%"]);
  });

  it("cycles through the color list if there are more slices than colors", () => {
    const slices = [
      { name: "A", total: "50.00" as never },
      { name: "B", total: "50.00" as never },
    ];
    const stops = buildDonutGradientStops(slices, "100.00" as never, ["red"]);
    expect(stops).toEqual(["red 0% 50%", "red 50% 100%"]);
  });

  it("treats a zero total as every slice contributing 0%", () => {
    const slices = [{ name: "A", total: "0.00" as never }];
    const stops = buildDonutGradientStops(slices, "0.00" as never, ["red"]);
    expect(stops).toEqual(["red 0% 0%"]);
  });
});
