"use server";

import { revalidatePath } from "next/cache";
import {
  MatchGenerationService,
  createMatchOpsService,
} from "@/application/services";
import { getDb } from "@/db/client";
import {
  formOptionalString,
  formString,
  withActor,
  type ActionResult,
} from "@/features/shared/action-utils";

function revalidateMatchViews(
  tournamentId: string,
  eventId: string,
  matchId?: string,
) {
  const base = `/admin/tournaments/${tournamentId}/events/${eventId}`;
  revalidatePath(base);
  revalidatePath(`${base}/matches`);
  revalidatePath(`${base}/groups`);
  if (matchId) {
    revalidatePath(`${base}/matches/${matchId}`);
  }
}

function parseSetsJson(formData: FormData) {
  const setsJson = formString(formData, "setsJson");
  return JSON.parse(setsJson) as unknown;
}

export async function startMatchAction(
  tournamentId: string,
  eventId: string,
  matchId: string,
  formData: FormData,
): Promise<ActionResult> {
  const result = await withActor(async (actor) => {
    const expectedUpdatedAt = formOptionalString(
      formData,
      "expectedUpdatedAt",
    );
    const service = createMatchOpsService(getDb());
    await service.startMatch(actor, matchId, expectedUpdatedAt ?? undefined);
  });
  if (result.ok) {
    revalidateMatchViews(tournamentId, eventId, matchId);
  }
  return result;
}

export async function enterScoreAction(
  tournamentId: string,
  eventId: string,
  formData: FormData,
): Promise<ActionResult> {
  const matchId = formString(formData, "matchId");
  const result = await withActor(async (actor) => {
    const service = createMatchOpsService(getDb());
    await service.enterScore(actor, {
      matchId,
      sets: parseSetsJson(formData),
      expectedUpdatedAt: formOptionalString(formData, "expectedUpdatedAt"),
    });
  });
  if (result.ok) {
    revalidateMatchViews(tournamentId, eventId, matchId);
  }
  return result;
}

export async function finishMatchAction(
  tournamentId: string,
  eventId: string,
  formData: FormData,
): Promise<ActionResult> {
  return enterScoreAction(tournamentId, eventId, formData);
}

export async function resolveSpecialAction(
  tournamentId: string,
  eventId: string,
  formData: FormData,
): Promise<ActionResult> {
  const matchId = formString(formData, "matchId");
  const setsRaw = formOptionalString(formData, "setsJson");
  const result = await withActor(async (actor) => {
    const service = createMatchOpsService(getDb());
    await service.resolveSpecial(actor, {
      matchId,
      resolution: formString(formData, "resolution"),
      winnerEntryId: formString(formData, "winnerEntryId"),
      sets: setsRaw ? (JSON.parse(setsRaw) as unknown) : undefined,
      expectedUpdatedAt: formOptionalString(formData, "expectedUpdatedAt"),
    });
  });
  if (result.ok) {
    revalidateMatchViews(tournamentId, eventId, matchId);
  }
  return result;
}

export async function cancelMatchAction(
  tournamentId: string,
  eventId: string,
  formData: FormData,
): Promise<ActionResult> {
  const matchId = formString(formData, "matchId");
  const result = await withActor(async (actor) => {
    const service = createMatchOpsService(getDb());
    await service.cancelMatch(actor, {
      matchId,
      reason: formOptionalString(formData, "reason") ?? undefined,
      expectedUpdatedAt: formOptionalString(formData, "expectedUpdatedAt"),
    });
  });
  if (result.ok) {
    revalidateMatchViews(tournamentId, eventId, matchId);
  }
  return result;
}

export async function correctScoreAction(
  tournamentId: string,
  eventId: string,
  formData: FormData,
): Promise<ActionResult> {
  const matchId = formString(formData, "matchId");
  const result = await withActor(async (actor) => {
    const service = createMatchOpsService(getDb());
    await service.correctScore(actor, {
      matchId,
      reason: formString(formData, "reason"),
      sets: parseSetsJson(formData),
      expectedUpdatedAt: formOptionalString(formData, "expectedUpdatedAt"),
    });
  });
  if (result.ok) {
    revalidateMatchViews(tournamentId, eventId, matchId);
  }
  return result;
}

export async function generateRoundRobinMatchesAction(
  tournamentId: string,
  eventId: string,
  stageId: string,
): Promise<ActionResult<{ created: number; skippedExisting: number }>> {
  const result = await withActor(async (actor) => {
    const service = new MatchGenerationService(getDb());
    const generated = await service.generateRoundRobinMatches(actor, {
      eventId,
      stageId,
    });
    return {
      created: generated.created,
      skippedExisting: generated.skippedExisting,
    };
  });
  if (result.ok) {
    revalidateMatchViews(tournamentId, eventId);
  }
  return result;
}
