import type { AppDatabase } from "@/db/client";
import { DrizzleUserRepository } from "@/db/repositories/user-repository";
import {
  UnauthorizedError,
} from "@/application/errors";
import { verifyPassword } from "@/lib/auth/password";
import type { SessionUser } from "@/lib/auth/session-user";

export type AuthenticateResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "invalid_credentials" | "inactive" };

/**
 * Pure credential check against the database (no cookie side effects).
 */
export async function authenticateCredentials(
  db: AppDatabase,
  username: string,
  password: string,
): Promise<AuthenticateResult> {
  const user = await new DrizzleUserRepository(db).findByUsername(username);
  if (!user) {
    return { ok: false, reason: "invalid_credentials" };
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    return { ok: false, reason: "invalid_credentials" };
  }

  if (!user.active) {
    return { ok: false, reason: "inactive" };
  }

  return {
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  };
}

export async function authenticateCredentialsOrThrow(
  db: AppDatabase,
  username: string,
  password: string,
): Promise<SessionUser> {
  const result = await authenticateCredentials(db, username, password);
  if (!result.ok) {
    if (result.reason === "inactive") {
      throw new UnauthorizedError("Account is inactive");
    }
    throw new UnauthorizedError("Invalid username or password");
  }
  return result.user;
}
