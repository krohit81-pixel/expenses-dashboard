"use server";

import {
  CARD_STATEMENT_LABELS,
  type CardStatementSource,
} from "@/features/imports/cards";
import {
  extractCardStatement,
  type StatementExtractionResult,
} from "@/services/StatementImportService";

const KNOWN_CARDS = Object.keys(CARD_STATEMENT_LABELS) as CardStatementSource[];

export interface ExtractStatementState {
  result?: StatementExtractionResult;
  error?: string;
}

/**
 * v1.3.0 milestone 1: accepts an uploaded statement PDF and returns its
 * extracted text so it can be reviewed on screen. Nothing is parsed into
 * transactions and nothing is persisted — this step only proves the
 * file can be reliably opened (including decrypting it, if the card's
 * password env var is set) and read.
 */
export async function extractStatementAction(
  _prevState: ExtractStatementState,
  formData: FormData,
): Promise<ExtractStatementState> {
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
  const result = await extractCardStatement(bytes, card as CardStatementSource);
  return { result };
}
