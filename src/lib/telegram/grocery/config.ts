import "server-only";
import { serverEnv } from "@/lib/env/server";

export function groceryConfig() {
  const botToken = serverEnv.TELEGRAM_GROCERY_BOT_TOKEN;
  const secret = serverEnv.TELEGRAM_GROCERY_WEBHOOK_SECRET;
  const chatId = serverEnv.TELEGRAM_GROCERY_CHAT_ID;
  const senders = (serverEnv.TELEGRAM_GROCERY_ALLOWED_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    !botToken ||
    !secret ||
    !/^[A-Za-z0-9_-]{32,256}$/.test(secret) ||
    !chatId ||
    !/^-\d+$/.test(chatId) ||
    !senders.length ||
    senders.some((id) => !/^\d+$/.test(id))
  )
    return null;
  return { botToken, secret, chatId, senders };
}
export const groceryWebhookPath = "/api/telegram/grocery/webhook";
