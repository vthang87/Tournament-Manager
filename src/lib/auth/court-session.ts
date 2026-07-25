import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

export const COURT_ACCESS_COOKIE = "tm_court_access";
export const COURT_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

export type CourtAccessSession = {
  type: "court";
  courtId: string;
  tournamentId: string;
};

type CourtClaims = JWTPayload & {
  typ: "court";
  courtId: string;
  tournamentId: string;
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

export async function encodeCourtAccessToken(
  session: CourtAccessSession,
  maxAgeSeconds = COURT_ACCESS_MAX_AGE_SECONDS,
): Promise<string> {
  return new SignJWT({
    typ: "court",
    courtId: session.courtId,
    tournamentId: session.tournamentId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.courtId)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(getSessionSecret());
}

export async function decodeCourtAccessToken(
  token: string,
): Promise<CourtAccessSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    const claims = payload as CourtClaims;
    if (
      claims.typ !== "court" ||
      typeof claims.courtId !== "string" ||
      typeof claims.tournamentId !== "string"
    ) {
      return null;
    }
    return {
      type: "court",
      courtId: claims.courtId,
      tournamentId: claims.tournamentId,
    };
  } catch {
    return null;
  }
}

export async function createCourtAccessSession(
  session: CourtAccessSession,
): Promise<void> {
  const token = await encodeCourtAccessToken(session);
  const cookieStore = await cookies();
  cookieStore.set(COURT_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COURT_ACCESS_MAX_AGE_SECONDS,
  });
}

export async function destroyCourtAccessSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COURT_ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function readCourtAccessSession(): Promise<CourtAccessSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COURT_ACCESS_COOKIE)?.value;
  if (!token) {
    return null;
  }
  return decodeCourtAccessToken(token);
}

/** Require a court session matching the given court (and optional tournament). */
export async function requireCourtAccess(
  courtId: string,
  tournamentId?: string,
): Promise<CourtAccessSession> {
  const session = await readCourtAccessSession();
  if (
    !session ||
    session.courtId !== courtId ||
    (tournamentId && session.tournamentId !== tournamentId)
  ) {
    throw new Error("COURT_ACCESS_REQUIRED");
  }
  return session;
}
