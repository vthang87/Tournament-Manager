import { describe, expect, it } from "vitest";
import {
  createCourtLinkToken,
  verifyCourtLinkToken,
} from "./court-link-token";

describe("court link token", () => {
  it("validates only for the bound court and PIN hash", () => {
    const token = createCourtLinkToken("court-1", "argon-hash-1");

    expect(token).not.toContain("argon-hash-1");
    expect(verifyCourtLinkToken("court-1", "argon-hash-1", token)).toBe(true);
    expect(verifyCourtLinkToken("court-2", "argon-hash-1", token)).toBe(false);
    expect(verifyCourtLinkToken("court-1", "argon-hash-2", token)).toBe(false);
  });

  it("rejects malformed tokens", () => {
    expect(verifyCourtLinkToken("court-1", "hash", "invalid")).toBe(false);
  });
});
