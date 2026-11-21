import { describe, expect, it } from "vitest";
import { extractPdfText } from "./extract-text";
import { parseIciciTransactions } from "@/services/statement-parsers/icici-amazon-rupay/parse-transactions";

// Entirely synthetic: the custom font name exercises the same pdf.js font
// identity lookup as an ICICI statement, without embedding financial data.
function overprintedPdf(): Uint8Array {
  const text = (font: string, x: number, y: number, value: string) =>
    `BT /${font} 6 Tf ${x} ${y} Td (${value}) Tj ET`;
  const content = [
    text("F1", 20, 750, "Transaction Details"),
    ...[0, 1].flatMap(() => [
      text("F1", 20, 700, "01/11/2026"),
      text("F1", 80, 700, "123456789"),
      text("F1", 140, 700, "SAMPLE GROCERY IN"),
      text("F1", 400, 700, "0"),
    ]),
    text("F2", 500, 700, "BCK.KK"),
    text("F2", 500, 680, "BCK.KK"),
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /VartaSet4 /Encoding /WinAnsiEncoding >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

describe("overprinted statement extraction", () => {
  it("uses actual font identity and removes duplicate fields before transaction parsing", async () => {
    const result = await extractPdfText(overprintedPdf());
    expect(result.text).not.toContain("BCK.KK");
    expect(result.text.match(/120\.00/g)).toHaveLength(2);
    const transactions = parseIciciTransactions(
      result.pages.map((page) => page.text),
      "SAMPLE USER",
    );
    expect(transactions).toHaveLength(1);
    expect(transactions[0].amount).toBe("120.00");
  });
});
