"use server";

import { revalidatePath } from "next/cache";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  AppError,
} from "@/application/errors";
import {
  CourtService,
  createMatchOpsService,
} from "@/application/services";
import type { ActorContext, MatchWithSets } from "@/core/domain";
import { getDb } from "@/db/client";
import { DrizzleCourtRepository } from "@/db/repositories/court-repository";
import { DrizzleMatchRepository } from "@/db/repositories/match-repository";
import { DrizzleTournamentRepository } from "@/db/repositories/tournament-repository";
import {
  formOptionalString,
  formString,
  type ActionResult,
} from "@/features/shared/action-utils";
import {
  createCourtAccessSession,
  destroyCourtAccessSession,
  readCourtAccessSession,
  type CourtAccessSession,
} from "@/lib/auth/court-session";
import { verifyCourtLinkToken } from "@/lib/auth/court-link-token";

function courtActor(courtId: string): ActorContext {
  return {
    userId: null,
    role: "SCOREKEEPER",
    auditMetadata: { via: "court_pin", courtId },
  };
}

function revalidateCourtScoring(
  slug: string,
  code: string,
  tournamentId: string,
  eventId?: string,
  matchId?: string,
) {
  revalidatePath(`/r/${slug}/c/${code}`);
  revalidatePath(`/t/${slug}/live`);
  revalidatePath(`/admin/tournaments/${tournamentId}/live`);
  revalidatePath(`/admin/tournaments/${tournamentId}/courts/live`);
  if (eventId) {
    const base = `/admin/tournaments/${tournamentId}/events/${eventId}`;
    revalidatePath(base);
    revalidatePath(`${base}/matches`);
    if (matchId) {
      revalidatePath(`${base}/matches/${matchId}`);
    }
  }
}

async function withCourtAction<T>(
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    if (err instanceof AppError) {
      return { ok: false, error: err.message, code: err.code };
    }
    if (err instanceof Error && err.message === "COURT_ACCESS_REQUIRED") {
      return {
        ok: false,
        error: "Court access required",
        code: "COURT_ACCESS_REQUIRED",
      };
    }
    throw err;
  }
}

async function resolveCourtContext(slug: string, code: string) {
  const db = getDb();
  const tournament = await new DrizzleTournamentRepository(db).findBySlug(
    slug,
  );
  if (!tournament) {
    throw new NotFoundError("Tournament not found");
  }
  const court = await new DrizzleCourtRepository(db).findByTournamentAndCode(
    tournament.id,
    code,
  );
  if (!court || !court.active) {
    throw new NotFoundError("Court not found");
  }
  return { db, tournament, court };
}

async function requireCourtSession(
  slug: string,
  code: string,
): Promise<{
  session: CourtAccessSession;
  tournamentId: string;
  courtId: string;
}> {
  const { tournament, court } = await resolveCourtContext(slug, code);
  const session = await readCourtAccessSession();
  if (
    !session ||
    session.courtId !== court.id ||
    session.tournamentId !== tournament.id
  ) {
    throw new UnauthorizedError("Court access required");
  }
  return {
    session,
    tournamentId: tournament.id,
    courtId: court.id,
  };
}

async function requireCourtSessionForMatch(
  slug: string,
  code: string,
  matchId: string,
) {
  const ctx = await requireCourtSession(slug, code);
  const match = await createMatchOpsService(getDb()).getById(matchId);
  if (match.courtId && match.courtId !== ctx.courtId) {
    throw new ForbiddenError("Match is not on this court");
  }
  return { ...ctx, match };
}

/**
 * For pre-start ops (call / swap / start): allow claiming an unstarted match
 * from another court or unassigned. Blocks IN_PROGRESS and finished matches.
 */
async function requireCourtSessionForClaimableMatch(
  slug: string,
  code: string,
  matchId: string,
) {
  const ctx = await requireCourtSession(slug, code);
  const match = await createMatchOpsService(getDb()).getById(matchId);
  if (match.status !== "PENDING" && match.status !== "SCHEDULED") {
    throw new ValidationError(
      "Only matches that have not started can be claimed",
      "MATCH_NOT_STARTABLE",
    );
  }
  if (match.courtId && match.courtId !== ctx.courtId) {
    // OK — will be reassigned on the mutating action.
  }
  return { ...ctx, match };
}

export async function unlockCourtAction(
  slug: string,
  code: string,
  formData: FormData,
): Promise<ActionResult> {
  return withCourtAction(async () => {
    const pin = formString(formData, "pin");
    const { db, tournament, court } = await resolveCourtContext(slug, code);
    const withHash = await new DrizzleCourtRepository(
      db,
    ).findByIdWithPinHash(court.id);
    if (!withHash?.accessPinHash) {
      throw new ValidationError(
        "Court scoring is not enabled",
        "COURT_PIN_DISABLED",
      );
    }
    const ok = await new CourtService(db).verifyAccessPin(court.id, pin);
    if (!ok) {
      throw new UnauthorizedError("Invalid PIN");
    }
    await createCourtAccessSession({
      type: "court",
      courtId: court.id,
      tournamentId: tournament.id,
    });
    revalidateCourtScoring(slug, code, tournament.id);
  });
}

export async function unlockCourtWithLinkTokenAction(
  slug: string,
  code: string,
  token: string,
): Promise<ActionResult> {
  return withCourtAction(async () => {
    const { db, tournament, court } = await resolveCourtContext(slug, code);
    const withHash = await new DrizzleCourtRepository(
      db,
    ).findByIdWithPinHash(court.id);
    if (
      !withHash?.accessPinHash ||
      !verifyCourtLinkToken(court.id, withHash.accessPinHash, token)
    ) {
      throw new UnauthorizedError("Invalid court access link");
    }
    await createCourtAccessSession({
      type: "court",
      courtId: court.id,
      tournamentId: tournament.id,
    });
    revalidateCourtScoring(slug, code, tournament.id);
  });
}

export async function lockCourtAction(
  slug: string,
  code: string,
): Promise<ActionResult> {
  return withCourtAction(async () => {
    const { tournament } = await resolveCourtContext(slug, code);
    await destroyCourtAccessSession();
    revalidateCourtScoring(slug, code, tournament.id);
  });
}

function parseSetsJson(formData: FormData) {
  const setsJson = formString(formData, "setsJson");
  return JSON.parse(setsJson) as unknown;
}

export async function courtSaveLiveScoreAction(
  slug: string,
  code: string,
  formData: FormData,
): Promise<ActionResult<{ updatedAt: string }>> {
  return withCourtAction(async () => {
    const matchId = formString(formData, "matchId");
    const { match, courtId, tournamentId } = await requireCourtSessionForMatch(
      slug,
      code,
      matchId,
    );
    if (match.status !== "IN_PROGRESS") {
      throw new ValidationError(
        "Match is not in progress",
        "MATCH_NOT_IN_PROGRESS",
      );
    }
    const service = createMatchOpsService(getDb());
    const updated = await service.saveLiveScore(courtActor(courtId), {
      matchId,
      sets: parseSetsJson(formData),
      expectedUpdatedAt: formOptionalString(formData, "expectedUpdatedAt"),
    });
    revalidateCourtScoring(slug, code, tournamentId, match.eventId, matchId);
    return { updatedAt: updated.updatedAt };
  });
}

export async function courtFinishMatchAction(
  slug: string,
  code: string,
  formData: FormData,
): Promise<ActionResult> {
  return withCourtAction(async () => {
    const matchId = formString(formData, "matchId");
    const { match, courtId, tournamentId } = await requireCourtSessionForMatch(
      slug,
      code,
      matchId,
    );
    if (match.status !== "IN_PROGRESS") {
      throw new ValidationError(
        "Match is not in progress",
        "MATCH_NOT_IN_PROGRESS",
      );
    }
    const service = createMatchOpsService(getDb());
    await service.enterScore(courtActor(courtId), {
      matchId,
      sets: parseSetsJson(formData),
      expectedUpdatedAt: formOptionalString(formData, "expectedUpdatedAt"),
    });
    revalidateCourtScoring(slug, code, tournamentId, match.eventId, matchId);
  });
}

export async function courtCallToCourtAction(
  slug: string,
  code: string,
  formData: FormData,
): Promise<ActionResult<{ warmupUntil: string }>> {
  return withCourtAction(async () => {
    const matchId = formString(formData, "matchId");
    const { match, courtId, tournamentId } =
      await requireCourtSessionForClaimableMatch(slug, code, matchId);
    const minutes = Number(formOptionalString(formData, "minutes") ?? "3");
    const service = createMatchOpsService(getDb());
    const updated = await service.callToCourt(
      courtActor(courtId),
      matchId,
      Number.isFinite(minutes) ? minutes : 3,
      formOptionalString(formData, "expectedUpdatedAt") ?? undefined,
      { courtId },
    );
    revalidateCourtScoring(slug, code, tournamentId, match.eventId, matchId);
    return { warmupUntil: updated.warmupUntil ?? "" };
  });
}

export async function courtCancelWarmupAction(
  slug: string,
  code: string,
  formData: FormData,
): Promise<ActionResult> {
  return withCourtAction(async () => {
    const matchId = formString(formData, "matchId");
    const { match, courtId, tournamentId } = await requireCourtSessionForMatch(
      slug,
      code,
      matchId,
    );
    const service = createMatchOpsService(getDb());
    await service.clearWarmup(
      courtActor(courtId),
      matchId,
      formOptionalString(formData, "expectedUpdatedAt") ?? undefined,
    );
    revalidateCourtScoring(slug, code, tournamentId, match.eventId, matchId);
  });
}

export async function courtSwapSidesAction(
  slug: string,
  code: string,
  formData: FormData,
): Promise<ActionResult> {
  return withCourtAction(async () => {
    const matchId = formString(formData, "matchId");
    const { match, courtId, tournamentId } =
      await requireCourtSessionForClaimableMatch(slug, code, matchId);
    const service = createMatchOpsService(getDb());
    await service.swapSides(
      courtActor(courtId),
      matchId,
      formOptionalString(formData, "expectedUpdatedAt") ?? undefined,
      { courtId },
    );
    revalidateCourtScoring(slug, code, tournamentId, match.eventId, matchId);
  });
}

export async function courtNoShowAction(
  slug: string,
  code: string,
  formData: FormData,
): Promise<ActionResult> {
  return withCourtAction(async () => {
    const matchId = formString(formData, "matchId");
    const absentEntryId = formString(formData, "absentEntryId");
    const { match, courtId, tournamentId } =
      await requireCourtSessionForClaimableMatch(slug, code, matchId);
    if (
      absentEntryId !== match.entryAId &&
      absentEntryId !== match.entryBId
    ) {
      throw new ValidationError(
        "Absent side must be one of the match participants",
        "INVALID_WINNER",
      );
    }
    const winnerEntryId =
      absentEntryId === match.entryAId ? match.entryBId : match.entryAId;
    const service = createMatchOpsService(getDb());
    await service.resolveSpecial(courtActor(courtId), {
      matchId,
      resolution: "NO_SHOW",
      winnerEntryId,
      expectedUpdatedAt:
        formOptionalString(formData, "expectedUpdatedAt") ?? undefined,
    });
    revalidateCourtScoring(slug, code, tournamentId, match.eventId, matchId);
  });
}

export async function courtStartAssignedMatchAction(
  slug: string,
  code: string,
  formData: FormData,
): Promise<ActionResult<{ matchId: string }>> {
  return withCourtAction(async () => {
    const matchId = formString(formData, "matchId");
    const { courtId, tournamentId } = await requireCourtSessionForClaimableMatch(
      slug,
      code,
      matchId,
    );
    const service = createMatchOpsService(getDb());
    const before = await service.getById(matchId);
    const busy = await new DrizzleMatchRepository(getDb()).findInProgressOnCourt(
      courtId,
    );
    if (busy) {
      throw new ValidationError(
        "Court already has a match in progress",
        "COURT_BUSY",
      );
    }
    await service.startMatch(
      courtActor(courtId),
      matchId,
      formOptionalString(formData, "expectedUpdatedAt") ?? undefined,
      { courtId },
    );
    revalidateCourtScoring(slug, code, tournamentId, before.eventId, matchId);
    return { matchId };
  });
}

export type CourtQueueMatch = {
  id: string;
  entryAId: string | null;
  entryBId: string | null;
  status: string;
  updatedAt: string;
  eventName: string;
  warmupUntil: string | null;
  scheduledAt: string | null;
  /** Already assigned to this court. */
  onThisCourt: boolean;
  /** Current assigned court code when on another court; null if unassigned/this court. */
  assignedCourtCode: string | null;
};

export type CourtScoringBoard = {
  unlocked: boolean;
  court: {
    id: string;
    name: string;
    code: string;
  };
  tournamentName: string;
  inProgress: MatchWithSets | null;
  /** @deprecated Prefer `queue`; kept as first queued match for convenience. */
  nextAssigned: CourtQueueMatch | null;
  /** Unstarted matches that can be claimed/started on this court. */
  queue: CourtQueueMatch[];
  entryLabels: Record<string, string>;
  /** Formatted club label per entry id (code · name), if any. */
  entryClubs: Record<string, string>;
};
