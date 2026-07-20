"use server";

import type { Money } from "@/lib/money";
import type { ExtractedPdfPage } from "@/lib/pdf/extract-text";
import {
  CARD_STATEMENT_LABELS,
  type CardStatementSource,
} from "@/features/imports/cards";
import {
  HdfcHeaderParseError,
  HdfcReconciliationError,
  HdfcTransactionParseError,
  saveHdfcInfiniaStatement,
} from "@/services/CreditCardStatementService";
import { extractCardStatement } from "@/services/StatementImportService";

const KNOWN_CARDS = Object.keys(CARD_STATEMENT_LABELS) as CardStatementSource[];

export interface StatementSummary {
  issuer: string;
  cardType: string;
  cardLast4: string;
  primaryCardholder: string;
  statementDate: string;
  dueDate: string;
  totalAmountDue: Money;
  minimumDue: Money;
  statementCurrency: string;
  transactionCount: number;
  needsReviewCount: number;
}

export interface ImportStatementState {
  status?: "saved" | "duplicate";
  summary?: StatementSummary;
  error?: string;
  /**
   * The raw per-page extracted text. Kept on every response (success or
   * failure) so a parsing or reconciliation problem can be diagnosed
   * against the real source text without re-uploading the PDF — shown
   * collapsed in the UI, not the primary result.
   */
  pages?: ExtractedPdfPage[];
}

/**
 * Phase 2: extracts an uploaded statement PDF's text, then parses,
 * reconciles, and saves it in one automatic step. Atlas has no manual
 * review/confirm screen for this — reconciliation (see
 * statement-parsers/hdfc-infinia/reconcile.ts) is the automated gate
 * that stands in for a human checking the numbers before anything is
 * written to the database: if the parsed transactions don't add up to
 * what the statement itself claims, nothing is saved and this returns a
 * clear error instead. Re-uploading the same statement is always safe —
 * saveHdfcInfiniaStatement detects the duplicate and saves nothing a
 * second time.
 */
export async function importStatementAction(
  _prevState: ImportStatementState,
  formData: FormData,
): Promise<ImportStatementState> {
  const card = formData.get("card");
  if (
    typeof card !== "string" ||
    !KNOWN_CARDS.includes(card as CardStatementSource)
  ) {
    return { error: "Choose which card this statement is for." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a PDF file to upload." };
  }
  if (file.type && file.type !== "application/pdf") {
    return { error: "That doesn't look like a PDF file." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const extraction = await extractCardStatement(
    bytes,
    card as CardStatementSource,
  );
  if (!extraction.ok) {
    return { error: extraction.message };
  }

  const pageTexts = extraction.pages.map((page) => page.text);

  try {
    const saved = await saveHdfcInfiniaStatement(pageTexts, file.name);
    return {
      status: saved.outcome,
      summary: {
        issuer: saved.header.issuer,
        cardType: saved.header.cardType,
        cardLast4: saved.header.cardLast4,
        primaryCardholder: saved.header.primaryCardholder,
        statementDate: saved.header.statementDate,
        dueDate: saved.header.dueDate,
        totalAmountDue: saved.header.totalAmountDue,
        minimumDue: saved.header.minimumDue,
        statementCurrency: saved.header.statementCurrency,
        transactionCount: saved.transactionCount,
        needsReviewCount: saved.needsReviewCount,
      },
      pages: extraction.pages,
    };
  } catch (error) {
    if (
      error instanceof HdfcHeaderParseError ||
      error instanceof HdfcTransactionParseError
    ) {
      return {
        error: `Couldn't make sense of this statement's layout: ${error.message} This can happen if HDFC changes their statement format — the extracted text below can help track down what changed.`,
        pages: extraction.pages,
      };
    }
    if (error instanceof HdfcReconciliationError) {
      return {
        error: `This statement parsed, but the numbers didn't add up, so nothing was saved: ${error.message}`,
        pages: extraction.pages,
      };
    }
    return {
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong saving this statement.",
      pages: extraction.pages,
    };
  }
}
