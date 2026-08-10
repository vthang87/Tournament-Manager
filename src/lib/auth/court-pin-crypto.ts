import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const FORMAT_VERSION = "v1";
const IV_BYTES = 12;

function encryptionKey(): Buffer {
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
    .update("tournament-manager:court-pin:")
    .update(secret)
    .digest();
}

/** Encrypts a PIN for authorized recovery. The Argon2 hash remains authoritative. */
export function encryptCourtPin(pin: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(pin, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    FORMAT_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

/** Returns null for legacy, corrupted, or differently-keyed encrypted values. */
export function decryptCourtPin(value: string | null): string | null {
  if (!value) return null;
  try {
    const [version, ivValue, tagValue, encryptedValue] = value.split(".");
    if (
      version !== FORMAT_VERSION ||
      !ivValue ||
      !tagValue ||
      !encryptedValue
    ) {
      return null;
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
