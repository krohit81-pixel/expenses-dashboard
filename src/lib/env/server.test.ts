import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * serverEnv is parsed eagerly at module import time (fail fast on
 * boot), so each case stubs env vars, resets the module registry, then
 * re-imports -- same convention as env/public.test.ts. server.ts also
 * imports "server-only", which throws unconditionally outside a real
 * Next.js build (Next's webpack config is what swaps it to a no-op for
 * server bundles; plain vitest never runs that step) -- mocked out
 * here so this file can still exercise the real parseServerEnv/zod
 * schema end to end. The empty/whitespace-only-optional-var behavior
 * itself (the actual v1.6.2 bug fix) has its own focused, mock-free
 * unit tests in optional-string.test.ts; this file just checks that
 * server.ts wires optionalEnvString() into the full schema correctly.
 */
vi.mock("server-only", () => ({}));

const REQUIRED_VALID_ENV = {
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  APP_OWNER_USER_ID: "550e8400-e29b-41d4-a716-446655440000",
  APP_ACCESS_PASSWORD: "correct-horse",
  APP_SESSION_SECRET: "a".repeat(32),
};

function stubRequiredEnv() {
  for (const [key, value] of Object.entries(REQUIRED_VALID_ENV)) {
    vi.stubEnv(key, value);
  }
}

describe("serverEnv", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses valid required values with every optional var unset", async () => {
    stubRequiredEnv();

    const { serverEnv } = await import("./server");

    expect(serverEnv.SUPABASE_SERVICE_ROLE_KEY).toBe("service-role-key");
    expect(serverEnv.ANTHROPIC_API_KEY).toBeUndefined();
    expect(serverEnv.GEMINI_API_KEY).toBeUndefined();
  });

  it("throws with a readable message when a required var is missing", async () => {
    stubRequiredEnv();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);

    await expect(import("./server")).rejects.toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it("keeps a real value for an optional var", async () => {
    stubRequiredEnv();
    vi.stubEnv("GEMINI_API_KEY", "AIzaSyRealKeyHere");

    const { serverEnv } = await import("./server");

    expect(serverEnv.GEMINI_API_KEY).toBe("AIzaSyRealKeyHere");
  });

  // The actual production bug this covers: Vercel's env var UI (among
  // other setups) can leave a variable "set" to an empty string
  // instead of genuinely unset -- e.g. the key was created but its
  // value field was left blank. Before optionalEnvString(), that
  // crashed the whole build/boot with "GEMINI_API_KEY: Invalid input"
  // even though GEMINI_API_KEY is meant to be optional.
  it("treats an empty-string optional var as unset rather than invalid", async () => {
    stubRequiredEnv();
    vi.stubEnv("GEMINI_API_KEY", "");

    const { serverEnv } = await import("./server");

    expect(serverEnv.GEMINI_API_KEY).toBeUndefined();
  });
});
