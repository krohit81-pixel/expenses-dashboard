import { describe, expect, it } from "vitest";
import { decodeStatementFont, deduplicateTextItems } from "./deduplicate-text";
const item = { str: "100.00", x: 541.62, y: 520, width: 18.79, height: 5.8 };
describe("statement font decoding", () => {
  it("decodes all ten glyphs and punctuation for the identified font", () => {
    expect(decodeStatementFont("BCDEFGHIJK,. ", "VartaSet4")).toBe(
      "1234567890,. ",
    );
    expect(decodeStatementFont("DK,CIE.DI", "ABCDEF+VartaSet4")).toBe(
      "30,284.38",
    );
  });
  it("does not reinterpret merchant names or unidentified fonts", () => {
    expect(decodeStatementFont("BIG", "Helvetica")).toBe("BIG");
    expect(decodeStatementFont("BIG SHOP", "VartaSet4")).toBe("BIG SHOP");
    expect(decodeStatementFont("100.00", "VartaSet4")).toBe("100.00");
  });
});
describe("overprinted PDF text layers", () => {
  it("prefers the decoded visible amount rather than a stale underlying amount", () => {
    const overlay = {
      ...item,
      str: "120.00",
      x: 541.68,
      width: 18.73,
      decodedAmount: true,
    };
    expect(deduplicateTextItems([item, overlay])).toEqual([overlay]);
    expect(item.str).toBe("100.00");
  });
  it("handles right-aligned amounts with different widths", () => {
    const overlay = {
      ...item,
      str: "1,200.00",
      x: item.x - 4,
      width: item.width + 4,
      decodedAmount: true,
    };
    expect(deduplicateTextItems([item, overlay])).toEqual([overlay]);
  });
  it("preserves conflicting ordinary text for reconciliation to reject", () => {
    expect(
      deduplicateTextItems([item, { ...item, str: "999.00" }]),
    ).toHaveLength(2);
  });
  it("removes repeated dates without merging separate transaction rows", () => {
    const date = { ...item, str: "01/11/2026", x: 30, width: 40 };
    const nextRow = { ...item, y: 510 };
    expect(deduplicateTextItems([date, { ...date }, item, nextRow])).toEqual([
      date,
      item,
      nextRow,
    ]);
  });
  it("preserves adjacent columns and different extents", () => {
    const column = { ...item, x: item.x + 20 };
    const extent = { ...item, width: item.width + 3 };
    expect(deduplicateTextItems([item, column, extent])).toEqual([
      item,
      column,
      extent,
    ]);
  });
  it("recognizes matching geometry across bucket boundaries", () => {
    expect(
      deduplicateTextItems([
        { ...item, y: 520.09 },
        { ...item, y: 520.11 },
      ]),
    ).toHaveLength(1);
  });
  it("replaces a combined hidden credit token only when both visible pieces exist", () => {
    const hidden = { ...item, str: "25000.00 CR", x: 520, width: 37 };
    const amount = {
      ...item,
      str: "30,000.00",
      x: 519,
      width: 28,
      decodedAmount: true,
    };
    const credit = { ...item, str: "CR", x: 549, width: 8 };
    expect(deduplicateTextItems([hidden, amount, credit])).toEqual([
      amount,
      credit,
    ]);
    expect(deduplicateTextItems([hidden, amount])).toHaveLength(2);
  });
});
