import { describe, expect, it } from "vitest";

import { optionalEnvString } from "./optional-string";

describe("optionalEnvString", () => {
  const schema = optionalEnvString();

  it("accepts undefined (genuinely unset)", () => {
    expect(schema.parse(undefined)).toBeUndefined();
  });

  it("keeps a real value as-is", () => {
    expect(schema.parse("AIzaSyRealKeyHere")).toBe("AIzaSyRealKeyHere");
  });

  // The actual production bug this covers: Vercel's env var UI (among
  // other setups) can leave a variable "set" to an empty string
  // instead of genuinely unset -- e.g. the key was created but its
  // value field was left blank, which crashed the whole build with
  // "GEMINI_API_KEY: Invalid input" even though GEMINI_API_KEY is
  // meant to be optional.
  it("treats an empty string as unset rather than invalid", () => {
    expect(schema.parse("")).toBeUndefined();
  });

  it("treats a whitespace-only string as unset rather than invalid", () => {
    expect(schema.parse("   ")).toBeUndefined();
  });

  it("still rejects non-string values", () => {
    expect(() => schema.parse(123)).toThrow();
  });
});
