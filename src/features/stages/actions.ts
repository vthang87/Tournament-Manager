"use server";

import { revalidatePath } from "next/cache";
import { MatchRuleService, StageService, EventSetupService } from "@/application/services";
import { getDb } from "@/db/client";
import type { StageFormat } from "@/core/domain";
import {
  formBool,
  formInt,
  formOptionalString,
  formString,
  withActor,
  type ActionResult,
} from "@/features/shared/action-utils";

export async function createStageAction(
  tournamentId: string,
  eventId: string,
  formData: FormData,
): Promise<ActionResult> {
  const result = await withActor(async (actor) => {
    const service = new StageService(getDb());
    const orderIndex = formInt(formData, "orderIndex") ?? 0;
    return service.create(actor, {
      eventId,
      type: formString(formData, "type"),
      name: formString(formData, "name"),
      orderIndex,
      format: formString(formData, "format") as StageFormat,
      matchRuleId: formOptionalString(formData, "matchRuleId"),
    });
  });
  if (result.ok) {
    revalidatePath(
      `/admin/tournaments/${tournamentId}/events/${eventId}/stages`,
    );
  }
  return result.ok ? { ok: true, data: undefined } : result;
}

export async function updateStageAction(
  tournamentId: string,
  eventId: string,
  stageId: string,
  formData: FormData,
): Promise<ActionResult> {
  const result = await withActor(async (actor) => {
    const service = new StageService(getDb());
    return service.update(actor, stageId, {
      type: formString(formData, "type"),
      name: formString(formData, "name"),
      format: formString(formData, "format") as StageFormat,
      matchRuleId: formOptionalString(formData, "matchRuleId"),
    });
  });
  if (result.ok) {
    revalidatePath(
      `/admin/tournaments/${tournamentId}/events/${eventId}/stages`,
    );
  }
  return result.ok ? { ok: true, data: undefined } : result;
}

export async function deleteStageAction(
  tournamentId: string,
  eventId: string,
  stageId: string,
): Promise<ActionResult> {
  const result = await withActor(async (actor) => {
    await new StageService(getDb()).delete(actor, stageId);
  });
  if (result.ok) {
    revalidatePath(
      `/admin/tournaments/${tournamentId}/events/${eventId}/stages`,
    );
  }
  return result;
}

export async function reorderStagesAction(
  tournamentId: string,
  eventId: string,
  orderedStageIds: string[],
): Promise<ActionResult> {
  const result = await withActor(async (actor) => {
    return new StageService(getDb()).reorder(actor, {
      eventId,
      orderedStageIds,
    });
  });
  if (result.ok) {
    revalidatePath(
      `/admin/tournaments/${tournamentId}/events/${eventId}/stages`,
    );
  }
  return result.ok ? { ok: true, data: undefined } : result;
}

export async function createMatchRuleAction(
  tournamentId: string,
  eventId: string,
  formData: FormData,
): Promise<ActionResult> {
  const result = await withActor(async (actor) => {
    return new MatchRuleService(getDb()).create(actor, {
      eventId,
      name: formString(formData, "name"),
      bestOfSets: formInt(formData, "bestOfSets") ?? 3,
      pointsToWin: formInt(formData, "pointsToWin") ?? 21,
      winBy: formInt(formData, "winBy") ?? 2,
      maxPoints: formInt(formData, "maxPoints") ?? 30,
      deuceEnabled: formBool(formData, "deuceEnabled"),
      changeEndsEnabled: formBool(formData, "changeEndsEnabled"),
      changeEndsAt: formInt(formData, "changeEndsAt") ?? 11,
    });
  });
  if (result.ok) {
    revalidatePath(
      `/admin/tournaments/${tournamentId}/events/${eventId}/rules`,
    );
    revalidatePath(
      `/admin/tournaments/${tournamentId}/events/${eventId}`,
    );
  }
  return result.ok ? { ok: true, data: undefined } : result;
}

export async function applyRulePresetAction(
  tournamentId: string,
  eventId: string,
  presetId: string,
): Promise<ActionResult<{ created: boolean }>> {
  const result = await withActor(async (actor) => {
    const applied = await new EventSetupService(getDb()).applyRulePreset(
      actor,
      eventId,
      presetId,
    );
    return { created: applied.created };
  });
  if (result.ok) {
    revalidatePath(
      `/admin/tournaments/${tournamentId}/events/${eventId}/rules`,
    );
    revalidatePath(`/admin/tournaments/${tournamentId}/events/${eventId}`);
    revalidatePath(
      `/admin/tournaments/${tournamentId}/events/${eventId}/stages`,
    );
  }
  return result;
}

export async function applySetupTemplateAction(
  tournamentId: string,
  eventId: string,
  templateId: string,
  replace = false,
): Promise<
  ActionResult<{
    rulesCreated: number;
    stagesCreated: number;
    replacedStages: number;
  }>
> {
  const result = await withActor(async (actor) => {
    const applied = await new EventSetupService(getDb()).applySetupTemplate(
      actor,
      eventId,
      templateId,
      { replace },
    );
    return {
      rulesCreated: applied.rulesCreated,
      stagesCreated: applied.stagesCreated,
      replacedStages: applied.replacedStages,
    };
  });
  if (result.ok) {
    revalidatePath(`/admin/tournaments/${tournamentId}/events/${eventId}`);
    revalidatePath(
      `/admin/tournaments/${tournamentId}/events/${eventId}/rules`,
    );
    revalidatePath(
      `/admin/tournaments/${tournamentId}/events/${eventId}/stages`,
    );
  }
  return result;
}
