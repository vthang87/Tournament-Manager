import { randomBytes } from "node:crypto";

/** URL-safe random ID without external dependency. */
export function createId(): string {
  return randomBytes(16).toString("hex");
}

export function nowIso(): string {
  return new Date().toISOString();
}
