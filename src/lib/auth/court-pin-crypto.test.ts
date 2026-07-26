import { describe, expect, it } from "vitest";
import { decryptCourtPin, encryptCourtPin } from "./court-pin-crypto";

describe("court PIN encryption", () => {
  it("round-trips a PIN without storing it as plaintext", () => {
    const encrypted = encryptCourtPin("1234");

    expect(encrypted).not.toContain("1234");
    expect(decryptCourtPin(encrypted)).toBe("1234");
  });

  it("rejects malformed ciphertext", () => {
    expect(decryptCourtPin("not-an-encrypted-pin")).toBeNull();
  });
});
