"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  extractStatementAction,
  type ExtractStatementState,
} from "@/features/imports/api/actions";
import { CARD_STATEMENT_LABELS } from "@/features/imports/cards";

const CARD_OPTIONS = Object.entries(CARD_STATEMENT_LABELS);

/**
 * v1.3.0 milestone 1 UI: upload a statement PDF and see the raw
 * extracted text back, per page. This exists to let the file be
 * visually checked against the real statement — nothing here writes
 * anything to the database. Once this is confirmed reliable against a
 * real, password-protected statement, the next milestone parses the
 * extracted text into reviewable transactions.
 */
export function StatementUploadForm() {
  const [card, setCard] = useState(CARD_OPTIONS[0][0]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [state, setState] = useState<ExtractStatementState>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setIsSubmitting(true);
    setState({});
    try {
      const next = await extractStatementAction(state, formData);
      setState(next);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="import-card">Card</Label>
          <select
            id="import-card"
            name="card"
            value={card}
            onChange={(event) => setCard(event.target.value)}
            className="h-11 w-full rounded-xl border-[1.5px] border-line bg-surface px-3 text-sm text-ink"
          >
            {CARD_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="import-file">Statement PDF</Label>
          <input
            id="import-file"
            name="file"
            type="file"
            accept="application/pdf"
            onChange={(event) =>
              setFileName(event.target.files?.[0]?.name ?? null)
            }
            className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-accent-soft file:px-4 file:py-2 file:font-display file:text-xs file:font-bold file:text-accent"
          />
          {fileName && (
            <p className="text-xs text-ink-faint">Selected: {fileName}</p>
          )}
        </div>

        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? "Reading…" : "Extract text"}
        </Button>
      </form>

      {state.error && (
        <p className="rounded-xl bg-negative-soft px-3 py-2 text-sm text-negative">
          {state.error}
        </p>
      )}

      {state.result && !state.result.ok && (
        <p className="rounded-xl bg-negative-soft px-3 py-2 text-sm text-negative">
          {state.result.message}
        </p>
      )}

      {state.result?.ok && (
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">
            Opened successfully — {state.result.pageCount}{" "}
            {state.result.pageCount === 1 ? "page" : "pages"}. Extracted text
            below, exactly as read (nothing parsed or saved yet).
          </p>
          {state.result.pages.map((page) => (
            <details
              key={page.pageNumber}
              className="rounded-xl border-[1.5px] border-line bg-surface"
              open={page.pageNumber === 1}
            >
              <summary className="cursor-pointer px-3 py-2 font-display text-xs font-bold text-ink">
                Page {page.pageNumber}
              </summary>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words px-3 pb-3 font-mono text-[11px] leading-relaxed text-ink-soft">
                {page.text || "(no text found on this page)"}
              </pre>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
