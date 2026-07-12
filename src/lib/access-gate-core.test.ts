import { describe, expect, it } from "vitest";

import {
  createSignedToken,
  timingSafeStringEqual,
  verifySignedToken,
} from "./access-gate-core";

const SECRET = "a-test-secret-value-that-is-long-enough";

describe("timingSafeStringEqual", () => {
  it("accepts matching strings", () => {
    expect(
      timingSafeStringEqual(SECRET, "correct-horse", "correct-horse"),
    ).toBe(true);
  });

  it("rejects non-matching strings", () => {
    expect(
      timingSafeStringEqual(SECRET, "correct-horse", "wrong-password"),
    ).toBe(false);
  });

  it("rejects strings of different length without throwing", () => {
    // timingSafeEqual throws on mismatched buffer lengths if not handled —
    // this is the regression test for that; comparing hashes instead of
    // raw strings sidesteps it.
    expect(() =>
      timingSafeStringEqual(SECRET, "correct-horse", "short"),
    ).not.toThrow();
    expect(timingSafeStringEqual(SECRET, "correct-horse", "short")).toBe(false);
  });
});

describe("createSignedToken / verifySignedToken", () => {
  it("a freshly created token verifies as valid", () => {
    const token = createSignedToken(SECRET);
    expect(verifySignedToken(SECRET, token)).toBe(true);
  });

  it("rejects an undefined token", () => {
    expect(verifySignedToken(SECRET, undefined)).toBe(false);
  });

  it("rejects an empty or malformed token", () => {
    expect(verifySignedToken(SECRET, "")).toBe(false);
    expect(verifySignedToken(SECRET, "not-a-real-token")).toBe(false);
    expect(verifySignedToken(SECRET, "12345")).toBe(false);
  });

  it("rejects a tampered signature", () => {
    const token = createSignedToken(SECRET);
    const [expiresAt] = token.split(".");
    const tampered = `${expiresAt}.${"0".repeat(64)}`;
    expect(verifySignedToken(SECRET, tampered)).toBe(false);
  });

  it("rejects a token verified against a different secret", () => {
    const token = createSignedToken(SECRET);
    expect(verifySignedToken("a-completely-different-secret", token)).toBe(
      false,
    );
  });

  it("rejects an expired token", () => {
    const expiredToken = createSignedToken(SECRET, -1000); // already expired
    expect(verifySignedToken(SECRET, expiredToken)).toBe(false);
  });

  it("accepts a token right up until its expiry, via a custom duration", () => {
    const token = createSignedToken(SECRET, 60_000); // 1 minute from now
    expect(verifySignedToken(SECRET, token)).toBe(true);
  });
});
