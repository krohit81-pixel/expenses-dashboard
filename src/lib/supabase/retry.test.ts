import { describe, expect, it, vi } from "vitest";

// retry.ts imports "server-only", which throws unconditionally outside
// a real Next.js build (Next's webpack config is what swaps it to a
// no-op for server bundles; plain vitest never runs that step) — same
// convention as env/server.test.ts.
vi.mock("server-only", () => ({}));

import { withAuthTimingRetry } from "@/lib/supabase/retry";

// Real PostgrestError has more fields (details, hint, code); every case
// here only needs `message`, which is all isTransientAuthTimingError
// actually reads.
function fakeError(message: string) {
  return { message, details: "", hint: "", code: "", name: "PostgrestError" };
}

describe("withAuthTimingRetry", () => {
  it("returns the first result unchanged when there's no error", async () => {
    const query = vi.fn().mockResolvedValue({ data: ["ok"], error: null });

    const result = await withAuthTimingRetry(query);

    expect(result).toEqual({ data: ["ok"], error: null });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("does not retry a non-transient error", async () => {
    const query = vi
      .fn()
      .mockResolvedValue({ data: null, error: fakeError("permission denied") });

    const result = await withAuthTimingRetry(query);

    expect(result.error?.message).toBe("permission denied");
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("retries once on the transient 'JWT issued at future' error and returns the retry's result", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: fakeError("JWT issued at future"),
      })
      .mockResolvedValueOnce({ data: ["ok"], error: null });

    const result = await withAuthTimingRetry(query);

    expect(result).toEqual({ data: ["ok"], error: null });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("also matches the 'issued in the future' wording and only retries once even if the retry fails too", async () => {
    const query = vi.fn().mockResolvedValue({
      data: null,
      error: fakeError("JWT issued in the future"),
    });

    const result = await withAuthTimingRetry(query);

    expect(result.error?.message).toBe("JWT issued in the future");
    expect(query).toHaveBeenCalledTimes(2);
  });
});
