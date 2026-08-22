import "server-only";

import { serverEnv } from "@/lib/env/server";
import type {
  NotificationMessage,
  NotificationProvider,
  SendResult,
} from "@/lib/notifications/provider";

/**
 * The first (and so far only) notification channel — v3.2.0. Plain
 * `fetch` against Telegram's Bot API, same shape as
 * lib/ai/providers.ts's callAnthropic/callGemini: one function per
 * concern, no SDK dependency for a single JSON POST.
 *
 * `target` is the recipient's numeric Telegram chat ID as a string —
 * this module has no idea how that id was obtained (today: pasted by
 * hand into Settings; a future `/start`-webhook linking flow would
 * populate the exact same value a different way). See
 * NotificationChannelService, which is the one place that distinction
 * lives — this file only ever sends to whatever target it's given.
 */
function telegramApiUrl(botToken: string, method: string): string {
  return `https://api.telegram.org/bot${botToken}/${method}`;
}

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  message: NotificationMessage,
): Promise<SendResult> {
  const text = `*${escapeMarkdown(message.title)}*\n${escapeMarkdown(message.body)}`;

  let response: Response;
  try {
    response = await fetch(telegramApiUrl(botToken, "sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "MarkdownV2",
      }),
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }

  if (!response.ok) {
    const body = await response.text();
    return {
      ok: false,
      error: `Telegram API returned ${response.status}: ${body.slice(0, 300)}`,
    };
  }

  const data: { result?: { message_id?: number } } = await response.json();
  return { ok: true, providerMessageId: data.result?.message_id?.toString() };
}

/**
 * Telegram's MarkdownV2 requires escaping a specific punctuation set or
 * the whole send fails with a 400 — titles/bodies here are app-authored
 * (an event title, a due date), not arbitrary user HTML, but names and
 * notes can still contain any of these characters (e.g. "Dinner w/
 * Sharma's (7pm)").
 */
const MARKDOWN_V2_SPECIAL = /[_*[\]()~`>#+\-=|{}.!\\]/g;
function escapeMarkdown(text: string): string {
  return text.replace(MARKDOWN_V2_SPECIAL, (char) => `\\${char}`);
}

export const telegramProvider: NotificationProvider = {
  channelType: "telegram",
  isConfigured(): boolean {
    return Boolean(serverEnv.TELEGRAM_BOT_TOKEN);
  },
  async send(target, message) {
    const botToken = serverEnv.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return { ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" };
    }
    return sendTelegramMessage(botToken, target, message);
  },
};
