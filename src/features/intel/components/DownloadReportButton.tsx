"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

const TIMEOUT_MS = 45_000;

function filenameFromContentDisposition(header: string | null): string {
  const match = header?.match(/filename="([^"]+)"/);
  return match?.[1] ?? "atlas-credit-card-report.pdf";
}

/**
 * v3.6.0 — the combined credit card report's own download trigger.
 * Originally a plain `<a href>` (matching the attachments download
 * route's convention), but that meant a full-page navigation to a
 * blank tab for however long the PDF takes to generate — reported by
 * the household as "blank white screen, don't know what's happening."
 * A generated file has no URL to link to ahead of time, so this fetches
 * it client-side instead, showing the same loading/error pattern
 * GenerateInsightButton already uses elsewhere on this page, then hands
 * the response off as a real browser download once it's ready. Stays
 * on the Intel page the whole time.
 */
export function DownloadReportButton() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsPending(true);
    setError(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch("/api/reports/credit-cards", {
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.error ?? `Report generation failed (HTTP ${response.status}).`,
        );
      }

      const blob = await response.blob();
      const filename = filenameFromContentDisposition(
        response.headers.get("content-disposition"),
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === "AbortError"
          ? "Report generation timed out. Please try again."
          : err instanceof Error
            ? err.message
            : "Something went wrong generating the report.",
      );
    } finally {
      clearTimeout(timeout);
      setIsPending(false);
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        loading={isPending}
        disabled={isPending}
        onClick={handleClick}
      >
        {isPending ? "Generating…" : "Download combined report (PDF)"}
      </Button>
      {error && <p className="mt-1.5 text-xs text-negative">{error}</p>}
    </div>
  );
}
