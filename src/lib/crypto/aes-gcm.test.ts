import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

import { encryptWithKey, decryptWithKey } from "./aes-gcm";

const KEY = createHash("sha256").update("test-key").digest();
const OTHER_KEY = createHash("sha256").update("different-test-key").digest();

describe("encryptWithKey/decryptWithKey", () => {
  it("round-trips a plaintext value", () => {
    const encrypted = encryptWithKey(KEY, "a-refresh-token-value");
    expect(decryptWithKey(KEY, encrypted)).toBe("a-refresh-token-value");
  });

  it("round-trips an empty string", () => {
    const encrypted = encryptWithKey(KEY, "");
    expect(decryptWithKey(KEY, encrypted)).toBe("");
  });

  it("produces a different ciphertext each call (fresh random IV)", () => {
    const first = encryptWithKey(KEY, "same plaintext");
    const second = encryptWithKey(KEY, "same plaintext");
    expect(first).not.toBe(second);
    // Both still decrypt to the same value.
    expect(decryptWithKey(KEY, first)).toBe("same plaintext");
    expect(decryptWithKey(KEY, second)).toBe("same plaintext");
  });

  it("throws when decrypting with the wrong key", () => {
    const encrypted = encryptWithKey(KEY, "secret");
    expect(() => decryptWithKey(OTHER_KEY, encrypted)).toThrow();
  });

  it("throws on malformed input (not the iv.authTag.ciphertext shape)", () => {
    expect(() => decryptWithKey(KEY, "not-a-valid-encrypted-value")).toThrow(
      "Malformed encrypted value",
    );
  });

  it("throws when the ciphertext has been tampered with (auth tag check fails)", () => {
    const encrypted = encryptWithKey(KEY, "secret");
    const [iv, authTag] = encrypted.split(".");
    // Flip the ciphertext to something else of the same shape.
    const tampered = [
      iv,
      authTag,
      Buffer.from("tampered!!!!").toString("base64"),
    ].join(".");
    expect(() => decryptWithKey(KEY, tampered)).toThrow();
  });
});
