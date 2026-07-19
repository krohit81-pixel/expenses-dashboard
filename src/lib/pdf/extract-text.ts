import { installDOMMatrixPolyfill } from "@/lib/pdf/dommatrix-polyfill";
import { installPdfjsWorker } from "@/lib/pdf/pdfjs-worker-setup";

/**
 * PDF text extraction with optional password decryption.
 *
 * v1.3.0 milestone 1 (statement imports): confirm password-protected
 * PDFs can be reliably opened and their text extracted, with table-like
 * layout (rows/columns) preserved well enough to read — not real
 * transaction parsing yet. That's a later milestone, once this proves
 * solid end to end against a real statement.
 *
 * Deliberately a pure function, not marked "server-only": it takes a
 * password as a plain argument rather than reading one from the
 * environment itself, so there's no secret embedded here to leak into a
 * client bundle — that's why it can have ordinary Vitest coverage below,
 * same as this app's other pure lib/ modules. The actual env-var lookup
 * (and the "server-only" guard that matters) lives one layer up, in
 * StatementImportService.ts. Also a separate code path from
 * AddTripModal's client-side itinerary PDF parsing: that one runs
 * unprotected travel PDFs in the browser; this one uses pdf.js's legacy
 * Node build so it can run server-side, where the password argument
 * actually comes from.
 */

export interface ExtractedPdfPage {
  pageNumber: number;
  text: string;
}

export interface ExtractedPdf {
  pageCount: number;
  pages: ExtractedPdfPage[];
  text: string;
}

/** The PDF is encrypted and no password (or an empty one) was supplied. */
export class PdfPasswordRequiredError extends Error {
  constructor() {
    super("This PDF is password protected — no password was supplied.");
    this.name = "PdfPasswordRequiredError";
  }
}

/** A password was supplied but pdf.js rejected it as incorrect. */
export class PdfPasswordIncorrectError extends Error {
  constructor() {
    super("The supplied password did not open this PDF.");
    this.name = "PdfPasswordIncorrectError";
  }
}

interface PositionedTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * pdf.js's own `TextItem` type isn't re-exported from the legacy Node
 * build's public entry point (only its internal `types/src/**` paths
 * have it), so this mirrors just the fields actually used here rather
 * than reaching into the package's internal type paths.
 */
interface PdfJsTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

// PDF coordinate units — text items whose baselines differ by no more
// than this are treated as being on the same visual line. A couple of
// units covers normal font-metric jitter within one printed row without
// merging two genuinely different rows.
const ROW_TOLERANCE = 2;

/**
 * Reconstructs a page's text from pdf.js's flat list of positioned text
 * items: groups items into rows by y-position, sorts each row
 * left-to-right, and inserts whitespace proportional to the horizontal
 * gap between items — a simplified version of what `pdftotext -layout`
 * does. This is what keeps a statement's columns (date / description /
 * amount, etc.) visually aligned instead of every row collapsing into
 * one run of words.
 */
function reconstructLayout(items: PositionedTextItem[]): string {
  const rows: PositionedTextItem[][] = [];
  const sortedByY = [...items].sort((a, b) => b.y - a.y);
  for (const item of sortedByY) {
    const row = rows.find((r) => Math.abs(r[0].y - item.y) <= ROW_TOLERANCE);
    if (row) {
      row.push(item);
    } else {
      rows.push([item]);
    }
  }

  return rows
    .map((row) => {
      const sorted = [...row].sort((a, b) => a.x - b.x);
      let line = "";
      let cursorEnd: number | null = null;
      for (const item of sorted) {
        if (cursorEnd !== null) {
          const gap = item.x - cursorEnd;
          if (gap > 0.5) {
            const spaceWidth = Math.max(item.height * 0.3, 2);
            const spaces = Math.max(
              1,
              Math.min(Math.round(gap / spaceWidth), 60),
            );
            line += " ".repeat(spaces);
          }
        }
        line += item.str;
        cursorEnd = item.x + item.width;
      }
      return line.trimEnd();
    })
    .join("\n");
}

// Legacy Node build — the default "browser" build of pdf.js assumes
// DOM/Worker globals that don't exist server-side. The legacy build runs
// headless in Node with no worker needed, which is what pdf.js itself
// recommends for server-side use.
async function loadPdfjs() {
  // Must run before pdf.js is imported: a module-level constant inside
  // pdf.js constructs a `new DOMMatrix()` unconditionally the moment the
  // module loads, so without a DOMMatrix global, every extraction fails
  // at import time, not just ones touching unusual PDF content. See
  // dommatrix-polyfill.ts for the full story on why this is a hand-written
  // polyfill instead of pdf.js's own native-dependency answer to the same
  // problem.
  installDOMMatrixPolyfill();
  // Also must run before pdf.js's own worker setup runs (which happens
  // when getDocument() is called, not at import time) -- see
  // pdfjs-worker-setup.ts for why.
  installPdfjsWorker();
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

/**
 * Opens a PDF from raw bytes, decrypting it with `password` if it's
 * protected, and returns per-page text with row/column layout preserved.
 *
 * Deliberately tolerant of `password` being supplied for a PDF that
 * turns out not to be encrypted — pdf.js just ignores an unnecessary
 * password, so callers don't need to know in advance whether a given
 * statement will actually be protected.
 */
export async function extractPdfText(
  bytes: Uint8Array,
  password?: string,
): Promise<ExtractedPdf> {
  const pdfjsLib = await loadPdfjs();

  let doc;
  try {
    doc = await pdfjsLib.getDocument({
      data: bytes,
      password,
      useSystemFonts: true,
    }).promise;
  } catch (error) {
    if (error instanceof pdfjsLib.PasswordException) {
      if (error.code === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD) {
        throw new PdfPasswordIncorrectError();
      }
      throw new PdfPasswordRequiredError();
    }
    throw error;
  }

  const pages: ExtractedPdfPage[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const items: PositionedTextItem[] = (content.items as unknown[])
      .filter(
        (item): item is PdfJsTextItem =>
          typeof item === "object" &&
          item !== null &&
          "str" in item &&
          typeof (item as PdfJsTextItem).str === "string" &&
          (item as PdfJsTextItem).str.length > 0,
      )
      .map((item) => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height || 10,
      }));
    pages.push({ pageNumber, text: reconstructLayout(items) });
  }

  return {
    pageCount: pages.length,
    pages,
    text: pages.map((p) => p.text).join("\n\n"),
  };
}
