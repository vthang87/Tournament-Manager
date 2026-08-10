"use server";

import { revalidatePath } from "next/cache";
import { CourtService } from "@/application/services";
import { getDb } from "@/db/client";
import {
  formBool,
  formString,
  withActor,
  type ActionResult,
} from "@/features/shared/action-utils";

export async function createCourtAction(
  tournamentId: string,
  formData: FormData,
): Promise<ActionResult> {
  const result = await withActor(async (actor) => {
    const service = new CourtService(getDb());
    return service.create(actor, {
      tournamentId,
      name: formString(formData, "name"),
      code: formString(formData, "code"),
      active: true,
    });
  });
  if (result.ok) {
    revalidatePath(`/admin/tournaments/${tournamentId}/courts`);
  }
  return result.ok ? { ok: true, data: undefined } : result;
}

export async function updateCourtAction(
  tournamentId: string,
  courtId: string,
  formData: FormData,
): Promise<ActionResult> {
  const result = await withActor(async (actor) => {
    const service = new CourtService(getDb());
    return service.update(actor, courtId, {
      name: formString(formData, "name"),
      code: formString(formData, "code"),
      active: formBool(formData, "active"),
    });
  });
  if (result.ok) {
    revalidatePath(`/admin/tournaments/${tournamentId}/courts`);
  }
  return result.ok ? { ok: true, data: undefined } : result;
}

export async function deleteCourtAction(
  tournamentId: string,
  courtId: string,
): Promise<ActionResult> {
  const result = await withActor(async (actor) => {
    const service = new CourtService(getDb());
    await service.delete(actor, courtId);
  });
  if (result.ok) {
    revalidatePath(`/admin/tournaments/${tournamentId}/courts`);
  }
  return result;
}

export async function setCourtAccessPinAction(
  tournamentId: string,
  courtId: string,
  formData: FormData,
): Promise<ActionResult> {
  const result = await withActor(async (actor) => {
    const service = new CourtService(getDb());
    await service.setAccessPin(actor, courtId, formString(formData, "pin"));
  });
  if (result.ok) {
    revalidatePath(`/admin/tournaments/${tournamentId}/courts`);
  }
  return result;
}

export async function clearCourtAccessPinAction(
  tournamentId: string,
  courtId: string,
): Promise<ActionResult> {
  const result = await withActor(async (actor) => {
    const service = new CourtService(getDb());
    await service.clearAccessPin(actor, courtId);
  });
  if (result.ok) {
    revalidatePath(`/admin/tournaments/${tournamentId}/courts`);
  }
  return result;
}
