import { describe, expect, it, vi, beforeEach } from "vitest";

// server-only throws unconditionally outside a real Next.js build —
// same convention as the sibling /api/cron/* route.test.ts files.
vi.mock("server-only", () => ({}));

const mockServerEnv: Record<string, string | undefined> = {
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  APP_OWNER_USER_ID: "550e8400-e29b-41d4-a716-446655440000",
  APP_ACCESS_PASSWORD: "test-password",
  APP_SESSION_SECRET: "a".repeat(32),
  CRON_SECRET: "test-cron-secret",
};

vi.mock("@/lib/env/server", () => ({
  get serverEnv() {
    return mockServerEnv;
  },
}));

const runAhaanaRemindersMock = vi.fn();
vi.mock("@/services/ReminderService", () => ({
  runAhaanaReminders: (...args: unknown[]) => runAhaanaRemindersMock(...args),
}));

import { GET } from "./route";

function requestWithAuth(header?: string): Request {
  const headers = new Headers();
  if (header !== undefined) headers.set("authorization", header);
  return new Request("http://localhost/api/cron/ahaana-reminders", {
    headers,
  });
}

describe("GET /api/cron/ahaana-reminders", () => {
  beforeEach(() => {
    mockServerEnv.CRON_SECRET = "test-cron-secret";
    mockServerEnv.APP_SESSION_SECRET = "a".repeat(32);
    runAhaanaRemindersMock.mockReset();
    runAhaanaRemindersMock.mockResolvedValue({
      candidates: 1,
      sent: 1,
      skipped: 0,
      failed: 0,
    });
  });

  it("rejects a request with no Authorization header", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await GET(requestWithAuth() as any);
    expect(res.status).toBe(401);
    expect(runAhaanaRemindersMock).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong bearer token", async () => {
    const res = await GET(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      requestWithAuth("Bearer not-the-secret") as any,
    );
    expect(res.status).toBe(401);
    expect(runAhaanaRemindersMock).not.toHaveBeenCalled();
  });

  it("refuses to run when CRON_SECRET isn't configured, even with a token", async () => {
    mockServerEnv.CRON_SECRET = undefined;
    const res = await GET(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      requestWithAuth("Bearer whatever") as any,
    );
    expect(res.status).toBe(503);
    expect(runAhaanaRemindersMock).not.toHaveBeenCalled();
  });

  it("runs Ahaana's reminders and returns the result for a valid bearer token", async () => {
    const res = await GET(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      requestWithAuth("Bearer test-cron-secret") as any,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ candidates: 1, sent: 1, skipped: 0, failed: 0 });
    expect(runAhaanaRemindersMock).toHaveBeenCalledTimes(1);
  });
});
