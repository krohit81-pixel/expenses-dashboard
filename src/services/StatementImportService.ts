import "server-only";

// pdf.js (extract-text.ts) needs this for its Node DOMMatrix/Path2D
// polyfill on certain PDF content (fonts with embedded glyph paths,
// shading patterns, etc. -- see extract-text.ts for detail). pdf.js
// loads it itself, lazily, via a `createRequire()` indirection written
// to survive bundlers -- but that same indirection is invisible to
// Vercel's deployment file tracer, which silently left this package's
// native binary out of the deployed function ("DOMMatrix is not
// defined" in production, despite working fine locally and in tests).
// An ordinary static import here is unambiguous for the tracer, and
// also warms Node's module cache so pdf.js's own later internal
// require resolves to this same already-loaded instance. See also
// next.config.ts's serverExternalPackages, which stops webpack from
// trying to inline this package's native binary into a JS chunk.
import "@napi-rs/canvas";
import { serverEnv } from "@/lib/env/server";
import type { CardStatementSource } from "@/features/imports/cards";
import {
  extractPdfText,
  PdfPasswordIncorrectError,
  PdfPasswordRequiredError,
  type ExtractedPdfPage,
} from "@/lib/pdf/extract-text";

function configuredPasswordFor(card: CardStatementSource): string | undefined {
  switch (card) {
    case "hdfc-infinia":
      return serverEnv.HDFC_INFINIA_STATEMENT_PASSWORD;
  }
}

export interface StatementExtractionSuccess {
  ok: true;
  pageCount: number;
  pages: ExtractedPdfPage[];
}

export interface StatementExtractionFailure {
  ok: false;
  reason: "password-required" | "password-incorrect" | "unreadable";
  message: string;
}

export type StatementExtractionResult =
  StatementExtractionSuccess | StatementExtractionFailure;

/**
 * Opens an uploaded statement PDF, decrypting it with the card's
 * configured password if one is set, and returns per-page text.
 *
 * Milestone 1 scope only: this confirms the PDF can be reliably opened
 * and read. It does not parse transactions out of the text — that's a
 * separate, later milestone once this step has proven solid against
 * real statements.
 */
export async function extractCardStatement(
  bytes: Uint8Array,
  card: CardStatementSource,
): Promise<StatementExtractionResult> {
  const password = configuredPasswordFor(card);

  try {
    const extracted = await extractPdfText(bytes, password);
    return { ok: true, pageCount: extracted.pageCount, pages: extracted.pages };
  } catch (error) {
    if (error instanceof PdfPasswordRequiredError) {
      return {
        ok: false,
        reason: "password-required",
        message: password
          ? // Shouldn't happen — we passed a password and pdf.js still
            // asked for one — but keep the message accurate either way
            // rather than claiming none was configured.
            "This PDF is password protected, but the configured password didn't open it."
          : `This PDF is password protected, but HDFC_INFINIA_STATEMENT_PASSWORD isn't set. Add it to your environment variables and try again.`,
      };
    }
    if (error instanceof PdfPasswordIncorrectError) {
      return {
        ok: false,
        reason: "password-incorrect",
        message:
          "The configured HDFC_INFINIA_STATEMENT_PASSWORD didn't open this PDF — double-check the value.",
      };
    }
    return {
      ok: false,
      reason: "unreadable",
      message:
        error instanceof Error
          ? `Couldn't read this PDF: ${error.message}`
          : "Couldn't read this PDF.",
    };
  }
}
