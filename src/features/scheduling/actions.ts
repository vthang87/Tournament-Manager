"use server";

import { revalidatePath } from "next/cache";
import { ValidationError } from "@/application/errors";
import { ScheduleService } from "@/application/services";
import { getDb } from "@/db/client";
import {
  formInt,
  formOptionalString,
  formString,
  withActor,
  type ActionResult,
} from "@/features/shared/action-utils";

function revalidateSchedulePaths(
  tournamentId: string,
  eventId: string,
) {
  revalidatePath(`/admin/tournaments/${tournamentId}/schedule`);
  revalidatePath(
    `/admin/tournaments/${tournamentId}/events/${eventId}/schedule`,
  );
}

export async function validateScheduleAssignmentsAction(
  formData: FormData,
): Promise<
  ActionResult<{
    conflicts: unknown[];
    hardCount: number;
    softCount: number;
  }>
> {
  return withActor(async () => {
    const service = new ScheduleService(getDb());
    const assignmentsJson = formString(formData, "assignmentsJson");
    let assignments: unknown;
    try {
      assignments = JSON.parse(assignmentsJson);
    } catch {
      throw new ValidationError("assignmentsJson must be valid JSON");
    }
    if (!Array.isArray(assignments)) {
      throw new ValidationError("assignments must be an array");
    }
    const conflicts = await service.validateSchedule(
      formString(formData, "eventId"),
      assignments as Array<{
        matchId: string;
        courtId: string;
        startTime: string;
        endTime?: string;
      }>,
      { stageId: formOptionalString(formData, "stageId") },
    );
    const hardCount = conflicts.filter((c) => c.severity === "error").length;
    const softCount = conflicts.filter((c) => c.severity === "warning").length;
    return { conflicts, hardCount, softCount };
  });
}

export async function saveScheduleAssignmentsAction(
  tournamentId: string,
  eventId: string,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const result = await withActor(async (actor) => {
    const service = new ScheduleService(getDb());
    const assignmentsJson = formString(formData, "assignmentsJson");
    let assignments: unknown;
    try {
      assignments = JSON.parse(assignmentsJson);
    } catch {
      throw new ValidationError("assignmentsJson must be valid JSON");
    }
    return service.saveAssignments(actor, {
      eventId: formString(formData, "eventId") || eventId,
      assignments,
      restMinutes: formInt(formData, "restMinutes"),
    });
  });
  if (result.ok) {
    revalidateSchedulePaths(tournamentId, eventId);
  }
  return result;
}

export async function bulkAssignMatchesAction(
  tournamentId: string,
  eventId: string,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const result = await withActor(async (actor) => {
    const service = new ScheduleService(getDb());
    const matchIdsJson = formString(formData, "matchIdsJson");
    const courtIdsJson = formString(formData, "courtIdsJson");
    let matchIds: unknown;
    let courtIds: unknown;
    try {
      matchIds = JSON.parse(matchIdsJson);
      courtIds = JSON.parse(courtIdsJson);
    } catch {
      throw new ValidationError("matchIdsJson/courtIdsJson must be valid JSON");
    }
    return service.bulkAssign(actor, {
      eventId: formString(formData, "eventId") || eventId,
      stageId: formString(formData, "stageId"),
      matchIds,
      courtIds,
      startTime: formString(formData, "startTime"),
      matchDurationMinutes:
        formInt(formData, "matchDurationMinutes") ?? 30,
      restMinutes: formInt(formData, "restMinutes") ?? 0,
    });
  });
  if (result.ok) {
    revalidateSchedulePaths(tournamentId, eventId);
  }
  return result;
}

export async function lockScheduleAction(
  tournamentId: string,
  eventId: string,
): Promise<ActionResult<unknown>> {
  const result = await withActor(async (actor) => {
    return new ScheduleService(getDb()).lockSchedule(actor, eventId);
  });
  if (result.ok) {
    revalidateSchedulePaths(tournamentId, eventId);
  }
  return result;
}

export async function createScheduleRuleAction(
  tournamentId: string,
  eventId: string,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const result = await withActor(async (actor) => {
    const service = new ScheduleService(getDb());
    return service.createRule(actor, {
      eventId,
      stageId: formOptionalString(formData, "stageId"),
      defaultMatchDurationMinutes:
        formInt(formData, "defaultMatchDurationMinutes") ?? 45,
      minimumRestMinutes: formInt(formData, "minimumRestMinutes") ?? 15,
      courtChangeBufferMinutes:
        formInt(formData, "courtChangeBufferMinutes") ?? 5,
      hardRestConflicts:
        formString(formData, "hardRestConflicts") === "true",
    });
  });
  if (result.ok) {
    revalidateSchedulePaths(tournamentId, eventId);
  }
  return result;
}
