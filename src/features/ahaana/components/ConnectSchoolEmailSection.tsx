"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import {
  testMailboxConnectionAction,
  type TestMailboxConnectionResult,
} from "@/features/ahaana/api/microsoft-actions";

const initialState: TestMailboxConnectionResult = { success: true };

function formatReceivedDate(dateISO: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(dateISO));
}

/**
 * v3.4.12 — proof-of-concept "Connect School Email" card. Deliberately
 * the simplest version of this: no OAuth, no "Connect" step at all —
 * the mailbox is either configured (both AHAANA_SCHOOL_EMAIL and
 * AHAANA_SCHOOL_EMAIL_PASSWORD env vars set) or it isn't, and the page
 * already knows which before this component even renders. "Test
 * Mailbox Connection" is the only interactive piece, an ordinary
 * useActionState + server action (same pattern as
 * EnablePushButton/RunRemindersButton).
 */
export function ConnectSchoolEmailSection({
  emailAddress,
}: {
  emailAddress: string | null;
}) {
  const [state, formAction, isPending] = useActionState(
    async () => testMailboxConnectionAction(),
    initialState,
  );

  return (
    <div className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
      <h2 className="mb-3 font-display text-sm font-bold text-ink">
        Ahaana&rsquo;s School Email
        <span className="ml-2 rounded-full bg-amber-soft px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-amber">
          Proof of concept
        </span>
      </h2>

      {!emailAddress ? (
        <p className="text-xs text-ink-faint">
          Not configured yet — set <code>AHAANA_SCHOOL_EMAIL</code> and{" "}
          <code>AHAANA_SCHOOL_EMAIL_PASSWORD</code> as environment variables to
          enable this.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-[14px] border border-line p-3">
            <span className="size-2 shrink-0 rounded-full bg-positive" />
            <div className="min-w-0">
              <div className="font-display text-[12.5px] font-bold text-ink">
                Connected
              </div>
              <div className="truncate text-[11px] text-ink-faint">
                {emailAddress}
              </div>
            </div>
          </div>

          <form action={formAction}>
            <Button
              type="submit"
              variant="outline"
              loading={isPending}
              className="w-full"
            >
              Test Mailbox Connection
            </Button>
          </form>

          {state.error && <FieldError message={state.error} />}
          {state.messages && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-positive">
                ✓ Connected — showing the latest {state.messages.length} Inbox
                messages
              </p>
              <ul className="space-y-2">
                {state.messages.map((message, i) => (
                  <li key={i} className="rounded-[14px] border border-line p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-display text-[12.5px] font-bold text-ink">
                        {message.sender}
                      </span>
                      <span className="shrink-0 text-[10px] text-ink-faint">
                        {formatReceivedDate(message.receivedDateTime)}
                      </span>
                    </div>
                    <p className="truncate text-[12px] font-semibold text-ink-soft">
                      {message.subject}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-ink-faint">
                      {message.bodyPreview}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
