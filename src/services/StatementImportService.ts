import "server-only";

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
    // Axis Atlas statements aren't password-protected (verified against
    // a real sample) -- no env var needed.
    case "axis-atlas":
      return undefined;
  }
}

/** Which env var (if any) a card's password comes from -- used only to
 * phrase the "no password configured" error message accurately per card,
 * instead of hardcoding HDFC's var name for every card. */
function passwordEnvVarNameFor(card: CardStatementSource): string | null {
  switch (card) {
    case "hdfc-infinia":
      return "HDFC_INFINIA_STATEMENT_PASSWORD";
    case "axis-atlas":
      return null;
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
  const envVarName = passwordEnvVarNameFor(card);

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
          : envVarName
            ? `This PDF is password protected, but ${envVarName} isn't set. Add it to your environment variables and try again.`
            : "This PDF is password protected, but this card isn't configured to expect one. Double-check this is the right statement.",
      };
    }
    if (error instanceof PdfPasswordIncorrectError) {
      return {
        ok: false,
        reason: "password-incorrect",
        message: envVarName
          ? `The configured ${envVarName} didn't open this PDF — double-check the value.`
          : "The password used to open this PDF didn't work.",
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
