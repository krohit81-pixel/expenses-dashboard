import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { timingSafeStringEqual } from "@/lib/access-gate-core";
import { serverEnv } from "@/lib/env/server";
import { groceryConfig } from "@/lib/telegram/grocery/config";
import { sendGroceryConnectionTest } from "@/lib/telegram/grocery/api";

const message = z.object({
  message_id: z.number().int().positive(),
  chat: z.object({
    id: z.number().int(),
    type: z.enum(["group", "supergroup"]),
  }),
  from: z.object({ id: z.number().int().positive(), is_bot: z.boolean() }),
  text: z.string().max(4096).optional(),
});
const update = z.object({
  update_id: z.number().int().nonnegative(),
  message: message.optional(),
  edited_message: message.optional(),
});

/** Connection-only endpoint: no model, database, calendar, retailer or payment calls. */
export async function POST(request: NextRequest) {
  const config = groceryConfig();
  if (!config)
    return NextResponse.json(
      { error: "Grocery Telegram configuration is incomplete" },
      { status: 503 },
    );
  const provided = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (
    !provided ||
    !timingSafeStringEqual(
      serverEnv.APP_SESSION_SECRET,
      config.secret,
      provided,
    )
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (Number(request.headers.get("content-length")) > 32_768)
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 32_768)
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true, ignored: true });
  }
  const parsed = update.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: true, ignored: true });
  const incoming = parsed.data.message ?? parsed.data.edited_message;
  if (
    !incoming ||
    String(incoming.chat.id) !== config.chatId ||
    incoming.from.is_bot ||
    !config.senders.includes(String(incoming.from.id))
  )
    return NextResponse.json({ ok: true, ignored: true });
  // Metadata-only receipt provides proof of delivery in Vercel logs. No message text or secrets.
  console.info("Atlas grocery Telegram receipt", {
    updateId: parsed.data.update_id,
    messageId: incoming.message_id,
    chatId: config.chatId,
    edited: !!parsed.data.edited_message,
  });
  const command = incoming.text?.trim().split(/\s/, 1)[0].toLowerCase();
  if (
    !parsed.data.edited_message &&
    ["/grocerytest", "/grocerytest@atlas_grocery_bot"].includes(command ?? "")
  ) {
    try {
      await sendGroceryConnectionTest(config.chatId, incoming.message_id);
    } catch {
      console.error("Atlas grocery connection-test reply failed");
      return NextResponse.json({ ok: true, received: true, replySent: false });
    }
    return NextResponse.json({ ok: true, received: true, replySent: true });
  }
  return NextResponse.json({
    ok: true,
    received: true,
    mode: "connection-test-only",
  });
}

/** Deployment checks use the grocery secret; no browser password or bot token is exposed. */
function checkMaintenance(request: NextRequest) {
  const config = groceryConfig();
  if (!config)
    return NextResponse.json(
      { error: "Grocery configuration incomplete" },
      { status: 503 },
    );
  const supplied = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (
    !supplied ||
    !timingSafeStringEqual(
      serverEnv.APP_SESSION_SECRET,
      config.secret,
      supplied,
    )
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}
export async function GET(request: NextRequest) {
  const denied = checkMaintenance(request);
  if (denied) return denied;
  const { groceryDiagnostics } = await import("@/lib/telegram/grocery/api");
  try {
    return NextResponse.json(
      await groceryDiagnostics("https://expdash.vercel.app"),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Telegram connection check failed" },
      { status: 502 },
    );
  }
}
export async function PUT(request: NextRequest) {
  const denied = checkMaintenance(request);
  if (denied) return denied;
  // Fixed production target: neither a supplied body nor Host can redirect bot updates.
  const { registerGroceryWebhook } = await import("@/lib/telegram/grocery/api");
  try {
    await registerGroceryWebhook("https://expdash.vercel.app");
    return NextResponse.json({ registered: true });
  } catch {
    return NextResponse.json(
      { error: "Grocery registration failed; check identity and group access" },
      { status: 502 },
    );
  }
}
