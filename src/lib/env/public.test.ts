import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * publicEnv is parsed eagerly at module import time (fail fast on boot),
 * so each case stubs env vars, resets the module registry, then re-imports.
 */
describe("publicEnv", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses valid values", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    const { publicEnv } = await import("./public");

    expect(publicEnv.NEXT_PUBLIC_SUPABASE_URL).toBe(
      "https://example.supabase.co",
    );
    expect(publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("anon-key");
  });

  it("throws with a readable message when the URL is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    await expect(import("./public")).rejects.toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it("throws when the URL is not a valid URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not-a-url");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    await expect(import("./public")).rejects.toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });
});
