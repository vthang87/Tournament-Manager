"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ClubService, PlayerService } from "@/application/services";
import type { PlayerGender } from "@/core/domain";
import { getDb } from "@/db/client";
import {
  formInt,
  formOptionalString,
  formString,
  withActor,
  type ActionResult,
} from "@/features/shared/action-utils";

export async function createClubAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await withActor(async (actor) => {
    return new ClubService(getDb()).create(actor, {
      name: formString(formData, "name"),
      shortName: formOptionalString(formData, "shortName"),
    });
  });
  if (result.ok) {
    revalidatePath("/admin/clubs");
    redirect(`/admin/clubs/${result.data.id}`);
  }
  return result as ActionResult<{ id: string }>;
}

export async function updateClubAction(
  clubId: string,
  formData: FormData,
): Promise<ActionResult> {
  const result = await withActor(async (actor) => {
    return new ClubService(getDb()).update(actor, clubId, {
      name: formString(formData, "name"),
      shortName: formOptionalString(formData, "shortName"),
    });
  });
  if (result.ok) {
    revalidatePath("/admin/clubs");
    revalidatePath(`/admin/clubs/${clubId}`);
  }
  return result.ok ? { ok: true, data: undefined } : result;
}

export async function createPlayerAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await withActor(async (actor) => {
    return new PlayerService(getDb()).create(actor, {
      name: formString(formData, "name"),
      displayName:
        formString(formData, "displayName") || formString(formData, "name"),
      gender: (formString(formData, "gender") ||
        "UNSPECIFIED") as PlayerGender,
      email: formOptionalString(formData, "email"),
      phone: formOptionalString(formData, "phone"),
      clubId: formOptionalString(formData, "clubId"),
      ranking: formInt(formData, "ranking"),
    });
  });
  if (result.ok) {
    revalidatePath("/admin/players");
    redirect(`/admin/players/${result.data.id}`);
  }
  return result as ActionResult<{ id: string }>;
}

export async function updatePlayerAction(
  playerId: string,
  formData: FormData,
): Promise<ActionResult> {
  const result = await withActor(async (actor) => {
    return new PlayerService(getDb()).update(actor, playerId, {
      name: formString(formData, "name"),
      displayName: formString(formData, "displayName"),
      gender: (formString(formData, "gender") ||
        "UNSPECIFIED") as PlayerGender,
      email: formOptionalString(formData, "email"),
      phone: formOptionalString(formData, "phone"),
      clubId: formOptionalString(formData, "clubId"),
      ranking: formInt(formData, "ranking"),
    });
  });
  if (result.ok) {
    revalidatePath("/admin/players");
    revalidatePath(`/admin/players/${playerId}`);
  }
  return result.ok ? { ok: true, data: undefined } : result;
}
