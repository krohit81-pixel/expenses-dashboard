import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  serverEnv: {
    TELEGRAM_BOT_TOKEN: "reminder-token",
    TELEGRAM_GROCERY_BOT_TOKEN: "grocery-token",
    TELEGRAM_GROCERY_WEBHOOK_SECRET: "g".repeat(32),
    TELEGRAM_GROCERY_CHAT_ID: "-5318544889",
    TELEGRAM_GROCERY_ALLOWED_USER_IDS: "8260412227",
  },
}));
import { serverEnv } from "@/lib/env/server";
import {
  groceryDiagnostics,
  groceryTelegramCall,
  registerGroceryWebhook,
} from "./api";
const fetchMock = vi.fn();
function respond(value: unknown) {
  return new Response(JSON.stringify({ ok: true, result: value }));
}
function diagnosticsResponses() {
  fetchMock
    .mockResolvedValueOnce(
      respond({
        id: 123,
        is_bot: true,
        username: "Atlas_Grocery_bot",
        can_read_all_group_messages: false,
      }),
    )
    .mockResolvedValueOnce(respond({ url: "", pending_update_count: 0 }))
    .mockResolvedValueOnce(
      respond({ id: -5318544889, title: "Kohli Kitchen", type: "group" }),
    )
    .mockResolvedValueOnce(respond({ status: "administrator" }));
}
describe("grocery bot API", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    serverEnv.TELEGRAM_GROCERY_BOT_TOKEN = "grocery-token";
  });
  afterEach(() => vi.unstubAllGlobals());
  it("checks identity and admin access without exposing credentials", async () => {
    diagnosticsResponses();
    const result = await groceryDiagnostics("https://atlas.example");
    expect(result).toMatchObject({
      botMatches: true,
      configured: true,
      canReceiveOrdinaryMessages: true,
      webhookMatches: false,
      group: { id: "-5318544889", title: "Kohli Kitchen" },
    });
    expect(JSON.stringify(result)).not.toContain("token");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
  it("uses only grocery credentials and preserves pending updates when explicitly registered", async () => {
    diagnosticsResponses();
    fetchMock.mockResolvedValueOnce(respond(true));
    await registerGroceryWebhook("https://atlas.example");
    const [url, options] = fetchMock.mock.calls[4];
    expect(url).toContain("botgrocery-token/setWebhook");
    expect(JSON.parse(options.body)).toEqual({
      url: "https://atlas.example/api/telegram/grocery/webhook",
      secret_token: "g".repeat(32),
      allowed_updates: ["message", "edited_message"],
      drop_pending_updates: false,
    });
  });
  it("refuses to replace the reminder bot webhook", async () => {
    serverEnv.TELEGRAM_GROCERY_BOT_TOKEN = "reminder-token";
    await expect(
      registerGroceryWebhook("https://atlas.example"),
    ).rejects.toThrow("separate");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("redacts token-bearing network and provider errors", async () => {
    fetchMock.mockRejectedValue(
      Error("https://api.telegram.org/botgrocery-token/getMe"),
    );
    await expect(groceryTelegramCall("getMe", {}, z.unknown())).rejects.toThrow(
      "Telegram getMe failed",
    );
    fetchMock.mockResolvedValue(new Response("grocery-token", { status: 401 }));
    try {
      await groceryTelegramCall("getMe", {}, z.unknown());
      expect.fail();
    } catch (e) {
      expect(String(e)).not.toContain("grocery-token");
    }
  });
});
