export interface PositionedTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  decodedAmount?: boolean;
}

const TOLERANCE = 0.2;

/** VartaSet4 prints digits using letter-named glyphs (B=1, …, K=0).
 * Only decode this identified font, never arbitrary merchant text.
 */
export function decodeStatementFont(str: string, fontName: string): string {
  if (
    !/^(?:[A-Z]{6}\+)?VartaSet4$/.test(fontName) ||
    !/^[B-K,.\s]+$/.test(str)
  ) {
    return str;
  }
  return str.replace(/[B-K]/g, (letter) =>
    String((letter.charCodeAt(0) - 65) % 10),
  );
}

/** Remove identical overprints and prefer the visible decoded amount over
 * its stale underlying text. Amounts are right-aligned, so their widths can
 * differ. Keep other conflicting text for reconciliation to reject safely.
 */
export function deduplicateTextItems(
  items: PositionedTextItem[],
): PositionedTextItem[] {
  const rows = new Map<number, PositionedTextItem[]>();
  const kept: PositionedTextItem[] = [];
  for (const item of items) {
    // Some PDFs combine the hidden amount and CR in one token, but print
    // the visible amount and CR separately. Only discard the combined token
    // when both visible pieces are present at the same location.
    if (
      /^[\d,.]+\s+CR$/.test(item.str) &&
      items.some(
        (other) =>
          other.decodedAmount &&
          Math.abs(other.y - item.y) <= TOLERANCE &&
          Math.abs(other.x - item.x) < item.height &&
          other.x + other.width < item.x + item.width,
      ) &&
      items.some(
        (other) =>
          other.str === "CR" &&
          Math.abs(other.y - item.y) <= TOLERANCE &&
          Math.abs(other.x + other.width - item.x - item.width) <= TOLERANCE,
      )
    )
      continue;
    const bucket = Math.round(item.y / TOLERANCE);
    let duplicate = false;
    for (let delta = -1; delta <= 1 && !duplicate; delta++) {
      for (const previous of rows.get(bucket + delta) ?? []) {
        if (
          Math.abs(previous.y - item.y) > TOLERANCE ||
          Math.abs(previous.height - item.height) > TOLERANCE
        )
          continue;
        const sameBounds =
          Math.abs(previous.x - item.x) <= TOLERANCE &&
          Math.abs(previous.width - item.width) <= TOLERANCE;
        const amountOverlay =
          item.decodedAmount &&
          /^[\d,.]+$/.test(previous.str.trim()) &&
          Math.abs(previous.x + previous.width - item.x - item.width) <=
            TOLERANCE &&
          Math.min(previous.width, item.width) /
            Math.max(previous.width, item.width) >=
            0.5;
        if (amountOverlay) {
          Object.assign(previous, item);
          duplicate = true;
          break;
        }
        if (sameBounds && previous.str === item.str) {
          duplicate = true;
          break;
        }
      }
    }
    if (duplicate) continue;
    const copy = { ...item };
    kept.push(copy);
    const row = rows.get(bucket) ?? [];
    row.push(copy);
    rows.set(bucket, row);
  }
  return kept;
}
