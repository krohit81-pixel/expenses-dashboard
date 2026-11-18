import "server-only";
import { z } from "zod";
import { serverEnv } from "@/lib/env/server";
import { groceryConfig, groceryWebhookPath } from "./config";

/** Never propagate Telegram errors or fetch exceptions: they can contain the token URL. */
export async function groceryTelegramCall<T>(
  method: string,
  body: object,
  schema: z.ZodType<T>,
): Promise<T> {
  const token = serverEnv.TELEGRAM_GROCERY_BOT_TOKEN;
  if (!token) throw new Error("Grocery bot token is not configured");
  let result: unknown;
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
        redirect: "error",
      },
    );
    if (!response.ok) throw new Error();
    const envelope = (await response.json()) as {
      ok?: boolean;
      result?: unknown;
    };
    if (!envelope.ok) throw new Error();
    result = envelope.result;
  } catch {
    throw new Error(
      `Telegram ${method} failed; check bot credentials, permissions and connectivity`,
    );
  }
  const parsed = schema.safeParse(result);
  if (!parsed.success)
    throw new Error(`Telegram ${method} returned an unexpected response`);
  return parsed.data;
}
const botSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  is_bot: z.literal(true),
  can_read_all_group_messages: z.boolean().optional(),
});
const chatSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  type: z.enum(["group", "supergroup"]),
});
const memberSchema = z.object({
  status: z.string(),
  can_send_messages: z.boolean().optional(),
});
const webhookSchema = z.object({
  url: z.string(),
  pending_update_count: z.number().optional(),
  last_error_date: z.number().optional(),
  allowed_updates: z.array(z.string()).optional(),
});
export async function groceryDiagnostics(origin: string) {
  const config = groceryConfig();
  const bot = await groceryTelegramCall("getMe", {}, botSchema);
  const webhook = await groceryTelegramCall(
    "getWebhookInfo",
    {},
    webhookSchema,
  );
  if (!config)
    return {
      bot: bot.username,
      botMatches: bot.username.toLowerCase() === "atlas_grocery_bot",
      configured: false,
      group: null,
      canReceiveOrdinaryMessages: false,
      webhookMatches: false,
      pendingUpdates: webhook.pending_update_count ?? 0,
      deliveryErrorAt: webhook.last_error_date ?? null,
    };
  const chat = await groceryTelegramCall(
    "getChat",
    { chat_id: config.chatId },
    chatSchema,
  );
  const member = await groceryTelegramCall(
    "getChatMember",
    { chat_id: config.chatId, user_id: bot.id },
    memberSchema,
  );
  const active = ["creator", "administrator", "member"].includes(member.status);
  return {
    bot: bot.username,
    botMatches: bot.username.toLowerCase() === "atlas_grocery_bot",
    configured: true,
    group: { id: String(chat.id), title: chat.title, status: member.status },
    canReceiveOrdinaryMessages:
      active &&
      (member.status === "administrator" ||
        member.status === "creator" ||
        bot.can_read_all_group_messages === true),
    webhookMatches: webhook.url === `${origin}${groceryWebhookPath}`,
    pendingUpdates: webhook.pending_update_count ?? 0,
    deliveryErrorAt: webhook.last_error_date ?? null,
  };
}
export async function registerGroceryWebhook(origin: string) {
  const config = groceryConfig();
  if (!config)
    throw new Error("Complete grocery configuration before registering");
  if (config.botToken === serverEnv.TELEGRAM_BOT_TOKEN)
    throw new Error("Grocery bot must be separate from the reminder bot");
  const url = new URL(origin);
  if (url.protocol !== "https:") throw new Error("HTTPS is required");
  const diagnostics = await groceryDiagnostics(origin);
  if (!diagnostics.botMatches || !diagnostics.canReceiveOrdinaryMessages)
    throw new Error(
      "Check the grocery bot identity and group message access first",
    );
  await groceryTelegramCall(
    "setWebhook",
    {
      url: `${origin}${groceryWebhookPath}`,
      secret_token: config.secret,
      allowed_updates: ["message", "edited_message"],
      drop_pending_updates: false,
    },
    z.literal(true),
  );
}
export async function sendGroceryConnectionTest(
  chatId: string,
  messageId: number,
) {
  return groceryTelegramCall(
    "sendMessage",
    {
      chat_id: chatId,
      text: "Atlas Grocery is connected to this group. This connection test does not update a shopping list or cart.",
      reply_parameters: { message_id: messageId },
    },
    z.object({ message_id: z.number().int() }),
  );
}
