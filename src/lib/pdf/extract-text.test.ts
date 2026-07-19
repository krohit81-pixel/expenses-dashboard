import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import {
  extractPdfText,
  PdfPasswordIncorrectError,
  PdfPasswordRequiredError,
} from "./extract-text";

// Fixtures are tiny, synthetic PDFs generated for this test suite only —
// no real statement content. Both have two pages: page one has two rows
// of three "columns" each (date / description / amount), page two is a
// single line. sample-encrypted.pdf is sample-unencrypted.pdf encrypted
// with qpdf (user password "userpass", owner password "ownerpass").
const FIXTURES_DIR = join(__dirname, "__fixtures__");

function loadFixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURES_DIR, name)));
}

describe("extractPdfText", () => {
  it("extracts text from an unencrypted PDF without a password", async () => {
    const result = await extractPdfText(loadFixture("sample-unencrypted.pdf"));

    expect(result.pageCount).toBe(2);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[1].text).toContain("Page two marker text");
  });

  it("preserves row and column order for table-like content", async () => {
    const result = await extractPdfText(loadFixture("sample-unencrypted.pdf"));
    const lines = result.pages[0].text.split("\n").filter(Boolean);

    // Two distinct rows, each with its three columns in left-to-right order.
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/18\/06\/2026.*GOOGLE PLAY MUMBAI.*2\.00/);
    expect(lines[1]).toMatch(/19\/06\/2026.*AMAZON RETAIL.*540\.50/);
  });

  it("ignores an unnecessary password on an unencrypted PDF", async () => {
    const result = await extractPdfText(
      loadFixture("sample-unencrypted.pdf"),
      "some-password-nobody-asked-for",
    );

    expect(result.pageCount).toBe(2);
  });

  it("decrypts and extracts an encrypted PDF given the correct password", async () => {
    const result = await extractPdfText(
      loadFixture("sample-encrypted.pdf"),
      "userpass",
    );

    expect(result.pageCount).toBe(2);
    expect(result.pages[0].text).toContain("GOOGLE PLAY MUMBAI");
    expect(result.pages[0].text).toContain("AMAZON RETAIL");
    expect(result.pages[1].text).toContain("Page two marker text");
  });

  it("throws PdfPasswordIncorrectError for the wrong password", async () => {
    await expect(
      extractPdfText(loadFixture("sample-encrypted.pdf"), "wrong-password"),
    ).rejects.toBeInstanceOf(PdfPasswordIncorrectError);
  });

  it("throws PdfPasswordRequiredError when no password is supplied", async () => {
    await expect(
      extractPdfText(loadFixture("sample-encrypted.pdf")),
    ).rejects.toBeInstanceOf(PdfPasswordRequiredError);
  });
});
