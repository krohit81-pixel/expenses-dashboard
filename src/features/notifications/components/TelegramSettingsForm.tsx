"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveTelegramChatIdAction,
  sendTestTelegramMessageAction,
  type SendTestMessageFormState,
  type TelegramChatIdFormState,
} from "@/features/notifications/api/actions";

const initialSaveState: TelegramChatIdFormState = {};
const initialTestState: SendTestMessageFormState = {};

/**
 * v3.2.0 — the only UI for linking the Telegram channel. Deliberately
 * a plain chat-ID field, not a `/start`-webhook flow (not built yet —
 * see NotificationChannelService's own comment on why this is
 * isolated behind that service instead of wired directly here). Two
 * independent actions, not one combined "save and test" step: saving
 * a chat ID shouldn't require a successful Telegram round trip just to
 * persist a value, and testing should be re-runnable without retyping
 * the ID.
 */
export function TelegramSettingsForm({
  initialChatId,
  isVerified,
}: {
  initialChatId: string | null;
  isVerified: boolean;
}) {
  const [chatId, setChatId] = useState(initialChatId ?? "");
  const [saveState, saveAction, isSaving] = useActionState(
    saveTelegramChatIdAction,
    initialSaveState,
  );
  const [testState, testAction, isTesting] = useActionState(
    sendTestTelegramMessageAction,
    initialTestState,
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-sm font-bold text-ink">Telegram</h3>
        <p className="mt-1 text-xs text-ink-faint">
          Message @BotFather on Telegram to create a bot, then @userinfobot to
          find your own numeric chat ID. Paste it below.
        </p>
      </div>

      <form action={saveAction} className="space-y-1.5">
        <Label htmlFor="telegram-chat-id">Your Telegram chat ID</Label>
        <div className="flex gap-2">
          <Input
            id="telegram-chat-id"
            name="chatId"
            placeholder="e.g. 987654321"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" variant="outline" loading={isSaving}>
            Save
          </Button>
        </div>
        <FieldError message={saveState.error} />
        {saveState.success && (
          <p className="text-xs font-semibold text-positive">Saved.</p>
        )}
      </form>

      <div>
        <form action={testAction}>
          <Button type="submit" loading={isTesting} disabled={!initialChatId}>
            Send test message
          </Button>
        </form>
        {isVerified && !testState.message && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-positive">
            <CheckCircle2 className="size-3.5" />
            Verified — a test message has gone through before.
          </p>
        )}
        {testState.message && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-positive">
            <CheckCircle2 className="size-3.5" />
            {testState.message}
          </p>
        )}
        <FieldError message={testState.error} />
      </div>
    </div>
  );
}
