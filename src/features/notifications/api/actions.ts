"use server";

import { revalidatePath } from "next/cache";

import {
  getChannel,
  markChannelVerified,
  setTelegramTarget,
} from "@/services/NotificationChannelService";
import { getProvider } from "@/lib/notifications/registry";
import {
  runReminders,
  runAhaanaWeeklyReportNow,
} from "@/services/ReminderService";

function formValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export interface TelegramChatIdFormState {
  error?: string;
  success?: boolean;
}

/** Just persists the chat ID — doesn't attempt to send anything, so a typo doesn't need a real Telegram round trip to catch (that's what "Send test message" is for). */
export async function saveTelegramChatIdAction(
  _prevState: TelegramChatIdFormState,
  formData: FormData,
): Promise<TelegramChatIdFormState> {
  const chatId = formValue(formData, "chatId");
  if (!chatId) {
    return { error: "Enter a chat ID first" };
  }
  if (!/^-?\d+$/.test(chatId.trim())) {
    return { error: "A Telegram chat ID is numeric (see @userinfobot)" };
  }

  try {
    await setTelegramTarget(chatId.trim());
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/settings");
  return { success: true };
}

export interface SendTestMessageFormState {
  error?: string;
  message?: string;
}

/**
 * The only way this app confirms a Telegram chat ID actually works —
 * a real send, not a validation heuristic. Marks the channel verified
 * on success, same "don't trust it until it's actually proven itself"
 * pattern as re-verifying a changed statement password by decrypting
 * with it, not by checking its shape.
 */
export async function sendTestTelegramMessageAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's action signature
  _prevState: SendTestMessageFormState,
): Promise<SendTestMessageFormState> {
  const channel = await getChannel("telegram");
  if (!channel?.target) {
    return { error: "Save a chat ID first" };
  }

  const provider = getProvider("telegram");
  if (!provider.isConfigured()) {
    return {
      error:
        "TELEGRAM_BOT_TOKEN isn't set on the server yet — add it as an environment variable, then redeploy.",
    };
  }

  const result = await provider.send(channel.target, {
    title: "Atlas",
    body: "This is a test reminder from Atlas. If you're reading this, Telegram notifications are working.",
  });

  if (!result.ok) {
    return { error: result.error ?? "Send failed for an unknown reason" };
  }

  await markChannelVerified("telegram");
  revalidatePath("/settings");
  return { message: "Sent — check Telegram." };
}

export interface RunRemindersFormState {
  error?: string;
  message?: string;
}

/**
 * The manual trigger behind "Run reminders now" — same role as
 * Recurring's GenerateDueTransactionsButton had before Vercel Cron
 * exists: lets the whole detect -> dedupe -> send pipeline be
 * exercised and verified by hand before anything runs on a schedule.
 */
export async function runRemindersAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's action signature
  _prevState: RunRemindersFormState,
): Promise<RunRemindersFormState> {
  try {
    const result = await runReminders();
    return {
      message: `Checked ${result.candidates} reminder${result.candidates === 1 ? "" : "s"} due today — sent ${result.sent}, skipped ${result.skipped} (already sent), ${result.failed} failed.`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }
}

export interface RunAhaanaWeeklyReportFormState {
  error?: string;
  message?: string;
}

/**
 * v3.4.0 Phase 3 — manual "Send Ahaana's weekly report now" trigger,
 * same role as runRemindersAction above but calling
 * runAhaanaWeeklyReportNow (which forces past the Sunday-only gate)
 * instead of runReminders — lets the report be pulled on demand
 * without waiting for Sunday, e.g. to check the pipeline works right
 * after adding her first activity.
 */
export async function runAhaanaWeeklyReportAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's action signature
  _prevState: RunAhaanaWeeklyReportFormState,
): Promise<RunAhaanaWeeklyReportFormState> {
  try {
    const result = await runAhaanaWeeklyReportNow();
    if (result.candidates === 0) {
      return {
        message:
          "Nothing to report — no activities were scheduled for Ahaana this week.",
      };
    }
    return {
      message: `Sent ${result.sent}, skipped ${result.skipped} (already sent this week), ${result.failed} failed.`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }
}
