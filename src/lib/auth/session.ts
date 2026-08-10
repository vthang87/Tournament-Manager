import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import type { UserRole } from "@/core/domain";
import type { SessionUser } from "./session-user";

export const SESSION_COOKIE_NAME = "tm_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

type SessionClaims = JWTPayload & {
  username: string;
  displayName: string;
  role: UserRole;
};

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to a string of at least 32 characters",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function encodeSessionToken(
  user: SessionUser,
  maxAgeSeconds = SESSION_MAX_AGE_SECONDS,
): Promise<string> {
  return new SignJWT({
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(getSessionSecret());
}

export async function decodeSessionToken(
  token: string,
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    const claims = payload as SessionClaims;
    if (
      !claims.sub ||
      typeof claims.username !== "string" ||
      typeof claims.displayName !== "string" ||
      typeof claims.role !== "string"
    ) {
      return null;
    }

    return {
      id: claims.sub,
      username: claims.username,
      displayName: claims.displayName,
      role: claims.role as UserRole,
    };
  } catch {
    return null;
  }
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await encodeSessionToken(user);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function readSessionFromCookies(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return decodeSessionToken(token);
}
