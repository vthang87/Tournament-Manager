import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const FORMAT_VERSION = "v1";

function signingKey(): Buffer {
  const configured = process.env.COURT_PIN_ENCRYPTION_KEY;
  const secret =
    configured && configured.length > 0
      ? configured
      : process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "COURT_PIN_ENCRYPTION_KEY or SESSION_SECRET must be at least 32 characters",
    );
  }
  return createHash("sha256")
    .update("tournament-manager:court-link:")
    .update(secret)
    .digest();
}

function signature(courtId: string, accessPinHash: string): Buffer {
  return createHmac("sha256", signingKey())
    .update(courtId)
    .update("\0")
    .update(accessPinHash)
    .digest();
}

/** Opaque URL token bound to both the court and its current PIN hash. */
export function createCourtLinkToken(
  courtId: string,
  accessPinHash: string,
): string {
  return `${FORMAT_VERSION}.${signature(courtId, accessPinHash).toString("base64url")}`;
}

/** A token becomes invalid automatically whenever the court PIN changes. */
export function verifyCourtLinkToken(
  courtId: string,
  accessPinHash: string,
  token: string,
): boolean {
  try {
    const [version, encoded, extra] = token.split(".");
    if (version !== FORMAT_VERSION || !encoded || extra) return false;
    const received = Buffer.from(encoded, "base64url");
    const expected = signature(courtId, accessPinHash);
    return (
      received.length === expected.length &&
      timingSafeEqual(received, expected)
    );
  } catch {
    return false;
  }
}
