"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EventService } from "@/application/services";
import { getDb } from "@/db/client";
import {
  formBool,
  formOptionalString,
  formString,
  withActor,
  type ActionResult,
} from "@/features/shared/action-utils";
import type { EventType, GenderCategory } from "@/core/domain";

export async function createEventAction(
  tournamentId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await withActor(async (actor) => {
    const service = new EventService(getDb());
    return service.create(actor, {
      tournamentId,
      name: formString(formData, "name"),
      type: formString(formData, "type") as EventType,
      genderCategory: formString(
        formData,
        "genderCategory",
      ) as GenderCategory,
      thirdPlaceMatchEnabled: formBool(formData, "thirdPlaceMatchEnabled"),
    });
  });

  if (result.ok) {
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    redirect(`/admin/tournaments/${tournamentId}/events/${result.data.id}`);
  }
  return result as ActionResult<{ id: string }>;
}

export async function updateEventAction(
  tournamentId: string,
  eventId: string,
  formData: FormData,
): Promise<ActionResult> {
  const result = await withActor(async (actor) => {
    const service = new EventService(getDb());
    const defaultMatchRuleId = formOptionalString(
      formData,
      "defaultMatchRuleId",
    );
    return service.update(actor, eventId, {
      name: formString(formData, "name"),
      type: formString(formData, "type") as EventType,
      genderCategory: formString(
        formData,
        "genderCategory",
      ) as GenderCategory,
      defaultMatchRuleId,
      thirdPlaceMatchEnabled: formBool(formData, "thirdPlaceMatchEnabled"),
    });
  });

  if (result.ok) {
    revalidatePath(`/admin/tournaments/${tournamentId}/events/${eventId}`);
    revalidatePath(`/admin/tournaments/${tournamentId}`);
  }
  return result.ok ? { ok: true, data: undefined } : result;
}

export async function markEventDrawReadyAction(
  tournamentId: string,
  eventId: string,
): Promise<ActionResult> {
  const result = await withActor(async (actor) => {
    const service = new EventService(getDb());
    return service.transitionStatus(actor, eventId, "DRAW_READY");
  });
  if (result.ok) {
    revalidatePath(`/admin/tournaments/${tournamentId}/events/${eventId}`);
  }
  return result.ok ? { ok: true, data: undefined } : result;
}
