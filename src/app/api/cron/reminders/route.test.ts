import { describe, expect, it, vi, beforeEach } from "vitest";

// server-only throws unconditionally outside a real Next.js build —
// same convention as MerchantMergeSuggestionService.test.ts. serverEnv
// is mocked per-test below (via vi.mocked) since this file needs to
// vary CRON_SECRET/APP_SESSION_SECRET across cases.
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

const runRemindersMock = vi.fn();
vi.mock("@/services/ReminderService", () => ({
  runReminders: (...args: unknown[]) => runRemindersMock(...args),
}));

import { GET } from "./route";

function requestWithAuth(header?: string): Request {
  const headers = new Headers();
  if (header !== undefined) headers.set("authorization", header);
  return new Request("http://localhost/api/cron/reminders", { headers });
}

describe("GET /api/cron/reminders", () => {
  beforeEach(() => {
    mockServerEnv.CRON_SECRET = "test-cron-secret";
    mockServerEnv.APP_SESSION_SECRET = "a".repeat(32);
    runRemindersMock.mockReset();
    runRemindersMock.mockResolvedValue({
      candidates: 2,
      sent: 1,
      skipped: 1,
      failed: 0,
    });
  });

  it("rejects a request with no Authorization header", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await GET(requestWithAuth() as any);
    expect(res.status).toBe(401);
    expect(runRemindersMock).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong bearer token", async () => {
    const res = await GET(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      requestWithAuth("Bearer not-the-secret") as any,
    );
    expect(res.status).toBe(401);
    expect(runRemindersMock).not.toHaveBeenCalled();
  });

  it("rejects a non-Bearer scheme even with the right token", async () => {
    const res = await GET(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      requestWithAuth("Basic test-cron-secret") as any,
    );
    expect(res.status).toBe(401);
    expect(runRemindersMock).not.toHaveBeenCalled();
  });

  it("refuses to run when CRON_SECRET isn't configured, even with a token", async () => {
    mockServerEnv.CRON_SECRET = undefined;
    const res = await GET(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      requestWithAuth("Bearer whatever") as any,
    );
    expect(res.status).toBe(503);
    expect(runRemindersMock).not.toHaveBeenCalled();
  });

  it("runs reminders and returns the result for a valid bearer token", async () => {
    const res = await GET(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      requestWithAuth("Bearer test-cron-secret") as any,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ candidates: 2, sent: 1, skipped: 1, failed: 0 });
    expect(runRemindersMock).toHaveBeenCalledTimes(1);
  });
});
