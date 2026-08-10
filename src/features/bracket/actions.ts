"use server";

import { revalidatePath } from "next/cache";
import { ValidationError } from "@/application/errors";
import { BracketService } from "@/application/services";
import { getDb } from "@/db/client";
import {
  formBool,
  formInt,
  formOptionalString,
  formString,
  withActor,
  type ActionResult,
} from "@/features/shared/action-utils";

function bracketPath(tournamentId: string, eventId: string) {
  return `/admin/tournaments/${tournamentId}/events/${eventId}/bracket`;
}

export async function createQualificationRuleAction(
  tournamentId: string,
  eventId: string,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const result = await withActor(async (actor) => {
    const service = new BracketService(getDb());
    return service.createQualificationRule(actor, {
      sourceStageId: formString(formData, "sourceStageId"),
      targetStageId: formString(formData, "targetStageId"),
      topPerGroup: formInt(formData, "topPerGroup") ?? 2,
      bestAdditionalEntries: formInt(formData, "bestAdditionalEntries") ?? 0,
      additionalFromRank: formInt(formData, "additionalFromRank"),
    });
  });
  if (result.ok) {
    revalidatePath(bracketPath(tournamentId, eventId));
  }
  return result;
}

export async function completeGroupStageAction(
  tournamentId: string,
  eventId: string,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const result = await withActor(async (actor) => {
    const service = new BracketService(getDb());
    return service.completeGroupStage(
      actor,
      formString(formData, "sourceStageId"),
    );
  });
  if (result.ok) {
    revalidatePath(bracketPath(tournamentId, eventId));
  }
  return result;
}

export async function resolveQualificationAction(
  tournamentId: string,
  eventId: string,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const result = await withActor(async (actor) => {
    const service = new BracketService(getDb());
    return service.resolveQualification(
      actor,
      formString(formData, "sourceStageId"),
      formOptionalString(formData, "targetStageId") ?? undefined,
    );
  });
  if (result.ok) {
    revalidatePath(bracketPath(tournamentId, eventId));
  }
  return result;
}

export async function previewBracketAction(
  formData: FormData,
): Promise<ActionResult<unknown>> {
  return withActor(async (actor) => {
    const service = new BracketService(getDb());
    const bracketSize = formInt(formData, "bracketSize");
    if (bracketSize == null) {
      throw new ValidationError("bracketSize is required");
    }
    return service.previewBracket(actor, {
      sourceStageId: formString(formData, "sourceStageId"),
      targetStageId: formString(formData, "targetStageId"),
      bracketSize,
      placementRule:
        formOptionalString(formData, "placementRule") ?? undefined,
      byeAssignment:
        formOptionalString(formData, "byeAssignment") ?? undefined,
      thirdPlaceEnabled: formBool(formData, "thirdPlaceEnabled"),
      avoidSameGroupRoundOne: !formBool(formData, "allowSameGroupRoundOne"),
    });
  });
}

export async function generateBracketAction(
  tournamentId: string,
  eventId: string,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const result = await withActor(async (actor) => {
    const service = new BracketService(getDb());
    const bracketSize = formInt(formData, "bracketSize");
    if (bracketSize == null) {
      throw new ValidationError("bracketSize is required");
    }
    return service.generateBracket(actor, {
      sourceStageId: formString(formData, "sourceStageId"),
      targetStageId: formString(formData, "targetStageId"),
      bracketSize,
      placementRule:
        formOptionalString(formData, "placementRule") ?? undefined,
      byeAssignment:
        formOptionalString(formData, "byeAssignment") ?? undefined,
      thirdPlaceEnabled: formBool(formData, "thirdPlaceEnabled"),
      avoidSameGroupRoundOne: !formBool(formData, "allowSameGroupRoundOne"),
    });
  });
  if (result.ok) {
    revalidatePath(bracketPath(tournamentId, eventId));
    revalidatePath(`/admin/tournaments/${tournamentId}/events/${eventId}`);
  }
  return result;
}

export async function adminResetBracketAction(
  tournamentId: string,
  eventId: string,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const result = await withActor(async (actor) => {
    const service = new BracketService(getDb());
    return service.adminResetBracket(actor, {
      stageId: formString(formData, "stageId"),
      reason: formString(formData, "reason"),
    });
  });
  if (result.ok) {
    revalidatePath(bracketPath(tournamentId, eventId));
  }
  return result;
}
