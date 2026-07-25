import { redirect } from "next/navigation";
import type { UserRole } from "@/core/domain";
import {
  ForbiddenError,
  UnauthorizedError,
} from "@/application/errors";
import { getDb } from "@/db/client";
import { DrizzleUserRepository } from "@/db/repositories/user-repository";
import { readSessionFromCookies } from "./session";
import type { SessionUser } from "./session-user";

function toSessionUser(user: {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
}): SessionUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };
}

/** Pure role check used by requireRole and unit tests. */
export function assertRole(
  user: SessionUser,
  roles: UserRole[],
): SessionUser {
  if (!roles.includes(user.role)) {
    throw new ForbiddenError(
      `Requires one of: ${roles.join(", ")} (have ${user.role})`,
    );
  }
  return user;
}

/**
 * Resolves the current user from the session cookie and re-checks DB (active).
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await readSessionFromCookies();
  if (!session) {
    return null;
  }

  const user = await new DrizzleUserRepository(getDb()).findById(session.id);
  if (!user || !user.active) {
    return null;
  }

  return toSessionUser(user);
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

export async function requireRole(roles: UserRole[]): Promise<SessionUser> {
  const user = await requireAuth();
  return assertRole(user, roles);
}

/** Guard for admin layouts: redirect to login when unauthenticated. */
export async function requireAuthOrRedirect(
  loginPath = "/login",
): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(loginPath);
  }
  return user;
}

/** Guard for role-restricted server pages/actions: redirect to unauthorized. */
export async function requireRoleOrRedirect(
  roles: UserRole[],
  unauthorizedPath = "/admin/unauthorized",
): Promise<SessionUser> {
  const user = await requireAuthOrRedirect();
  if (!roles.includes(user.role)) {
    redirect(unauthorizedPath);
  }
  return user;
}
