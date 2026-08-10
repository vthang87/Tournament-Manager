"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TournamentService } from "@/application/services";
import { getDb } from "@/db/client";
import {
  formOptionalString,
  formString,
  withActor,
  type ActionResult,
} from "@/features/shared/action-utils";

export async function createTournamentAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await withActor(async (actor) => {
    const service = new TournamentService(getDb());
    return service.create(actor, {
      name: formString(formData, "name"),
      sportId: formString(formData, "sportId"),
      slug: formString(formData, "slug"),
      description: formOptionalString(formData, "description"),
      location: formOptionalString(formData, "location"),
      timezone: formString(formData, "timezone") || "Asia/Ho_Chi_Minh",
      startDate: formOptionalString(formData, "startDate"),
      endDate: formOptionalString(formData, "endDate"),
    });
  });

  if (result.ok) {
    revalidatePath("/admin/tournaments");
    redirect(`/admin/tournaments/${result.data.id}`);
  }
  return result as ActionResult<{ id: string }>;
}

export async function updateTournamentAction(
  tournamentId: string,
  formData: FormData,
): Promise<ActionResult> {
  const result = await withActor(async (actor) => {
    const service = new TournamentService(getDb());
    return service.update(actor, tournamentId, {
      name: formString(formData, "name"),
      sportId: formString(formData, "sportId"),
      slug: formString(formData, "slug"),
      description: formOptionalString(formData, "description"),
      location: formOptionalString(formData, "location"),
      timezone: formString(formData, "timezone") || "Asia/Ho_Chi_Minh",
      startDate: formOptionalString(formData, "startDate"),
      endDate: formOptionalString(formData, "endDate"),
    });
  });

  if (result.ok) {
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    revalidatePath("/admin/tournaments");
  }
  return result.ok ? { ok: true, data: undefined } : result;
}

export async function archiveTournamentAction(
  tournamentId: string,
): Promise<ActionResult> {
  const result = await withActor(async (actor) => {
    const service = new TournamentService(getDb());
    return service.archive(actor, tournamentId);
  });
  if (result.ok) {
    revalidatePath(`/admin/tournaments/${tournamentId}`);
    revalidatePath("/admin/tournaments");
  }
  return result.ok ? { ok: true, data: undefined } : result;
}

export async function advanceTournamentAction(
  tournamentId: string,
  toStatus: "REGISTRATION" | "DRAW" | "IN_PROGRESS" | "COMPLETED",
): Promise<ActionResult> {
  const result = await withActor(async (actor) => {
    const service = new TournamentService(getDb());
    return service.transitionStatus(actor, tournamentId, toStatus);
  });
  if (result.ok) {
    revalidatePath(`/admin/tournaments/${tournamentId}`);
  }
  return result.ok ? { ok: true, data: undefined } : result;
}
