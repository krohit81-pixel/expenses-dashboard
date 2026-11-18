import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/telegram/grocery/api", () => ({
  registerGroceryWebhook: vi.fn(),
}));
import { registerGroceryWebhook } from "@/lib/telegram/grocery/api";
import { POST } from "./route";
beforeEach(() => vi.resetAllMocks());
it("requires same-origin POST before any configuration mutation", async () => {
  const r = await POST(
    new NextRequest("https://atlas.example/api/telegram/grocery/setup", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    }),
  );
  expect(r.status).toBe(403);
  expect(registerGroceryWebhook).not.toHaveBeenCalled();
});
it("registers only after the explicit same-origin form action", async () => {
  const r = await POST(
    new NextRequest("https://atlas.example/api/telegram/grocery/setup", {
      method: "POST",
      headers: { origin: "https://atlas.example" },
    }),
  );
  expect(r.status).toBe(303);
  expect(registerGroceryWebhook).toHaveBeenCalledWith("https://atlas.example");
});
