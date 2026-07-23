// Not part of the icici-amazon parser -- a throwaway script used once to
// validate the parser against a real, personal statement PDF outside
// the repo (never committed). Left as an inert, skipped test only
// because the sandbox this was written in can't delete files; safe to
// delete by hand.
import { describe, it, expect } from "vitest";

describe.skip("scratch (not part of the suite)", () => {
  it("noop", () => {
    expect(true).toBe(true);
  });
});
