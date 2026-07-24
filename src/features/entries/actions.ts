"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EntryService } from "@/application/services";
import { getDb } from "@/db/client";
import {
  formInt,
  formOptionalString,
  formString,
  withActor,
  type ActionResult,
} from "@/features/shared/action-utils";

function parseMembers(formData: FormData) {
  const members: { playerId: string; position: number }[] = [];
  for (let position = 1; position <= 8; position++) {
    const playerId = formOptionalString(formData, `player${position}`);
    if (playerId) {
      members.push({ playerId, position });
    }
  }
  return members;
}

export async function createEntryAction(
  tournamentId: string,
  eventId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await withActor(async (actor) => {
    return new EntryService(getDb()).create(actor, {
      eventId,
      displayName: formString(formData, "displayName"),
      seed: formInt(formData, "seed"),
      ranking: formInt(formData, "ranking"),
      clubId: formOptionalString(formData, "clubId"),
      members: parseMembers(formData),
    });
  });
  if (result.ok) {
    revalidatePath(
      `/admin/tournaments/${tournamentId}/events/${eventId}/entries`,
    );
    redirect(
      `/admin/tournaments/${tournamentId}/events/${eventId}/entries`,
    );
  }
  return result as ActionResult<{ id: string }>;
}

export async function updateEntryAction(
  tournamentId: string,
  eventId: string,
  entryId: string,
  formData: FormData,
): Promise<ActionResult> {
  const result = await withActor(async (actor) => {
    return new EntryService(getDb()).update(actor, entryId, {
      displayName: formString(formData, "displayName"),
      seed: formInt(formData, "seed"),
      ranking: formInt(formData, "ranking"),
      clubId: formOptionalString(formData, "clubId"),
      members: parseMembers(formData),
    });
  });
  if (result.ok) {
    revalidatePath(
      `/admin/tournaments/${tournamentId}/events/${eventId}/entries`,
    );
  }
  return result.ok ? { ok: true, data: undefined } : result;
}

export async function withdrawEntryAction(
  tournamentId: string,
  eventId: string,
  entryId: string,
): Promise<ActionResult> {
  const result = await withActor(async (actor) => {
    return new EntryService(getDb()).setStatus(actor, entryId, "WITHDRAWN");
  });
  if (result.ok) {
    revalidatePath(
      `/admin/tournaments/${tournamentId}/events/${eventId}/entries`,
    );
  }
  return result.ok ? { ok: true, data: undefined } : result;
}

export async function disqualifyEntryAction(
  tournamentId: string,
  eventId: string,
  entryId: string,
): Promise<ActionResult> {
  const result = await withActor(async (actor) => {
    return new EntryService(getDb()).setStatus(
      actor,
      entryId,
      "DISQUALIFIED",
    );
  });
  if (result.ok) {
    revalidatePath(
      `/admin/tournaments/${tournamentId}/events/${eventId}/entries`,
    );
  }
  return result.ok ? { ok: true, data: undefined } : result;
}

export async function deleteEntryAction(
  tournamentId: string,
  eventId: string,
  entryId: string,
): Promise<ActionResult> {
  const result = await withActor(async (actor) => {
    return new EntryService(getDb()).deleteOrWithdraw(actor, entryId);
  });
  if (result.ok) {
    revalidatePath(
      `/admin/tournaments/${tournamentId}/events/${eventId}/entries`,
    );
  }
  return result.ok ? { ok: true, data: undefined } : result;
}
