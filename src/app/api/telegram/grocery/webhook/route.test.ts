import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  serverEnv: {
    APP_SESSION_SECRET: "a".repeat(32),
    TELEGRAM_GROCERY_BOT_TOKEN: "grocery-token",
    TELEGRAM_GROCERY_WEBHOOK_SECRET: "g".repeat(32),
    TELEGRAM_GROCERY_CHAT_ID: "-5318544889",
    TELEGRAM_GROCERY_ALLOWED_USER_IDS: "8260412227",
  },
}));
vi.mock("@/lib/telegram/grocery/api", () => ({
  sendGroceryConnectionTest: vi.fn(),
}));
import { serverEnv } from "@/lib/env/server";
import { sendGroceryConnectionTest } from "@/lib/telegram/grocery/api";
import { GET, POST, PUT } from "./route";
const incoming = {
  message_id: 55,
  chat: { id: -5318544889, type: "group" },
  from: { id: 8260412227, is_bot: false },
  text: "Amul milk 2 litres",
};
function request(body: unknown, secret = "g".repeat(32)) {
  return new NextRequest("https://atlas.example/api/telegram/grocery/webhook", {
    method: "POST",
    headers: { "x-telegram-bot-api-secret-token": secret },
    body: JSON.stringify(body),
  });
}
describe("separate grocery webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    serverEnv.TELEGRAM_GROCERY_WEBHOOK_SECRET = "g".repeat(32);
    vi.mocked(sendGroceryConnectionTest).mockResolvedValue({ message_id: 100 });
  });
  it("fails closed on missing configuration or the reminder secret", async () => {
    serverEnv.TELEGRAM_GROCERY_WEBHOOK_SECRET = undefined;
    expect((await POST(request({}))).status).toBe(503);
    serverEnv.TELEGRAM_GROCERY_WEBHOOK_SECRET = "g".repeat(32);
    expect((await POST(request({}, "reminder-secret"))).status).toBe(401);
  });
  it("receives ordinary grocery text without calling outbound APIs", async () => {
    const r = await POST(request({ update_id: 1, message: incoming }));
    expect(await r.json()).toMatchObject({
      received: true,
      mode: "connection-test-only",
    });
    expect(sendGroceryConnectionTest).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith(
      "Atlas grocery Telegram receipt",
      { updateId: 1, messageId: 55, chatId: "-5318544889", edited: false },
    );
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain(
      incoming.text,
    );
  });
  it.each([
    { ...incoming, chat: { id: -12, type: "group" } },
    { ...incoming, from: { id: 42, is_bot: false } },
    { ...incoming, from: { id: 8260412227, is_bot: true } },
  ])("ignores untrusted groups, senders and bots", async (message) => {
    expect(
      await (await POST(request({ update_id: 1, message }))).json(),
    ).toEqual({ ok: true, ignored: true });
    expect(sendGroceryConnectionTest).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
  });
  it("replies only to an authorized explicit connection test", async () => {
    const r = await POST(
      request({
        update_id: 2,
        message: { ...incoming, text: "/grocerytest@Atlas_Grocery_bot" },
      }),
    );
    expect(await r.json()).toMatchObject({ replySent: true });
    expect(sendGroceryConnectionTest).toHaveBeenCalledWith("-5318544889", 55);
  });
  it("does not repeat a test reply for an edited command", async () => {
    await POST(
      request({
        update_id: 3,
        edited_message: { ...incoming, text: "/grocerytest" },
      }),
    );
    expect(sendGroceryConnectionTest).not.toHaveBeenCalled();
  });
  it("does not report failed replies as sent or retry them", async () => {
    vi.mocked(sendGroceryConnectionTest).mockRejectedValue(Error("network"));
    expect(
      await (
        await POST(
          request({
            update_id: 4,
            message: { ...incoming, text: "/grocerytest" },
          }),
        )
      ).json(),
    ).toMatchObject({ replySent: false });
    expect(sendGroceryConnectionTest).toHaveBeenCalledTimes(1);
  });
  it("ignores malformed updates and bounds payload size", async () => {
    expect(
      await (
        await POST(request({ update_id: 1, message: { text: "fake" } }))
      ).json(),
    ).toMatchObject({ ignored: true });
    expect((await POST(request("x".repeat(33_000)))).status).toBe(413);
  });
});

it("protects maintenance diagnostics and registration with the grocery secret", async () => {
  expect((await GET(request({}, "wrong"))).status).toBe(401);
  expect((await PUT(request({}, "wrong"))).status).toBe(401);
});
