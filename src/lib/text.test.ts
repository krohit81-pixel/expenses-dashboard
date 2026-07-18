import { describe, expect, it } from "vitest";

import { truncate } from "./text";

describe("truncate", () => {
  it("leaves short text untouched", () => {
    expect(truncate("Goa trip", 15)).toBe("Goa trip");
  });

  it("leaves text exactly at the limit untouched", () => {
    expect(truncate("Exactly15Chars!", 15)).toBe("Exactly15Chars!");
  });

  it("shortens long text to maxLength, ellipsis included", () => {
    const result = truncate("Educational Trip, Grades 6-8", 15);
    expect(result).toHaveLength(15);
    expect(result).toBe("Educational Tr…");
  });

  it("handles a real destination + flight label from the calendar grid", () => {
    const result = truncate("Singapore · AI 380", 15);
    expect(result).toHaveLength(15);
    expect(result.endsWith("…")).toBe(true);
  });

  it("handles maxLength of 1", () => {
    expect(truncate("Hello", 1)).toBe("…");
  });

  it("handles empty string", () => {
    expect(truncate("", 15)).toBe("");
  });
});
