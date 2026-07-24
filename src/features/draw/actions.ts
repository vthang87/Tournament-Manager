"use server";

import { revalidatePath } from "next/cache";
import {
  ClubService,
  DrawService,
  EntryService,
  MatchGenerationService,
} from "@/application/services";
import { getDb } from "@/db/client";
import {
  formBool,
  formInt,
  formString,
  withActor,
  type ActionResult,
} from "@/features/shared/action-utils";

function drawPath(tournamentId: string, eventId: string) {
  return `/admin/tournaments/${tournamentId}/events/${eventId}/draw`;
}

export async function generateDrawAction(
  tournamentId: string,
  eventId: string,
  formData: FormData,
): Promise<
  ActionResult<{
    sessionId: string;
    warningCount: number;
    groups: Array<{ id: string; name: string; code: string }>;
    placements: Array<{
      groupId: string;
      entryId: string;
      position: number;
      displayName: string;
      seed: number | null;
      clubCode: string | null;
      clubName: string | null;
    }>;
  }>
> {
  const result = await withActor(async (actor) => {
    const db = getDb();
    const service = new DrawService(db);
    const groupCount = formInt(formData, "groupCount");
    const capacityPerGroup = formInt(formData, "capacityPerGroup");
    const randomSeedRaw = formString(formData, "randomSeed");
    const randomSeedNum = Number(randomSeedRaw);
    const randomSeed =
      randomSeedRaw !== "" && Number.isFinite(randomSeedNum)
        ? randomSeedNum
        : randomSeedRaw || String(Date.now());

    const generated = await service.generateDraw(actor, {
      eventId,
      stageId: formString(formData, "stageId"),
      configuration: {
        seedDistribution: formString(formData, "seedDistribution"),
        avoidSameClub: formBool(formData, "avoidSameClub"),
        avoidSameTeam: formBool(formData, "avoidSameTeam"),
        avoidSameRegion: formBool(formData, "avoidSameRegion"),
        groupCount: groupCount ?? 1,
        capacityPerGroup: capacityPerGroup ?? 1,
      },
      randomSeed,
    });

    const entries = await new EntryService(db).listByEvent(eventId);
    const clubs = await new ClubService(db).list();
    const clubById = new Map(clubs.map((c) => [c.id, c]));
    const entryById = new Map(entries.map((e) => [e.id, e]));

    return {
      sessionId: generated.session.id,
      warningCount: generated.warnings.length,
      groups: generated.groups.map((g) => ({
        id: g.id,
        name: g.name,
        code: g.code,
      })),
      placements: generated.results.map((r) => {
        const entry = entryById.get(r.entryId);
        const club = entry?.clubId ? clubById.get(entry.clubId) : undefined;
        return {
          groupId: r.groupId,
          entryId: r.entryId,
          position: r.position,
          displayName: entry?.displayName ?? r.entryId,
          seed: entry?.seed ?? null,
          clubCode: club?.shortName ?? null,
          clubName: club?.name ?? null,
        };
      }),
    };
  });

  if (result.ok) {
    revalidatePath(drawPath(tournamentId, eventId));
    revalidatePath(`${drawPath(tournamentId, eventId)}/history`);
    revalidatePath(`/admin/tournaments/${tournamentId}/events/${eventId}`);
  }
  return result;
}

export async function validateManualDrawAction(
  drawSessionId: string,
  allocation: Array<{
    groupId: string;
    entryId: string;
    position?: number;
  }>,
): Promise<
  ActionResult<{
    valid: boolean;
    issues: Array<{
      code: string;
      message: string;
      severity: "error" | "warning";
      entityIds?: string[];
    }>;
  }>
> {
  return withActor(async (actor) => {
    const validation = await new DrawService(getDb()).validateManualAdjustment(
      actor,
      { drawSessionId, allocation },
    );
    return {
      valid: validation.valid,
      issues: validation.issues,
    };
  });
}

export async function saveManualDrawAction(
  tournamentId: string,
  eventId: string,
  drawSessionId: string,
  allocation: Array<{
    groupId: string;
    entryId: string;
    position?: number;
  }>,
): Promise<
  ActionResult<{
    valid: boolean;
    warningCount: number;
  }>
> {
  const result = await withActor(async (actor) => {
    const saved = await new DrawService(getDb()).saveManualAdjustment(actor, {
      drawSessionId,
      allocation,
    });
    return {
      valid: saved.validation.valid,
      warningCount: saved.validation.issues.filter(
        (issue) => issue.severity === "warning",
      ).length,
    };
  });

  if (result.ok) {
    revalidatePath(drawPath(tournamentId, eventId));
  }
  return result;
}

export async function confirmDrawAction(
  tournamentId: string,
  eventId: string,
  drawSessionId: string,
): Promise<ActionResult<{ groupEntries: number }>> {
  const result = await withActor(async (actor) => {
    const confirmed = await new DrawService(getDb()).confirmDraw(actor, {
      drawSessionId,
    });
    return { groupEntries: confirmed.groupEntries };
  });

  if (result.ok) {
    revalidatePath(drawPath(tournamentId, eventId));
    revalidatePath(`${drawPath(tournamentId, eventId)}/history`);
    revalidatePath(`/admin/tournaments/${tournamentId}/events/${eventId}`);
  }
  return result;
}

export async function generateRoundRobinAction(
  tournamentId: string,
  eventId: string,
  stageId: string,
): Promise<ActionResult<{ created: number; skippedExisting: number }>> {
  const result = await withActor(async (actor) => {
    const generated = await new MatchGenerationService(
      getDb(),
    ).generateRoundRobinMatches(actor, { eventId, stageId });
    return {
      created: generated.created,
      skippedExisting: generated.skippedExisting,
    };
  });

  if (result.ok) {
    revalidatePath(drawPath(tournamentId, eventId));
    revalidatePath(`/admin/tournaments/${tournamentId}/events/${eventId}`);
  }
  return result;
}
