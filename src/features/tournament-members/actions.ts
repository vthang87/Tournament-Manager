"use server";

import { revalidatePath } from "next/cache";
import { TournamentMemberService } from "@/application/services";
import type { TournamentMemberRole } from "@/core/domain";
import { getDb } from "@/db/client";
import {
  formString,
  withActor,
  type ActionResult,
} from "@/features/shared/action-utils";

const MEMBER_ROLES = new Set<TournamentMemberRole>([
  "ADMIN",
  "OPERATOR",
  "SCOREKEEPER",
  "VIEWER",
]);

function memberRole(formData: FormData): TournamentMemberRole {
  const role = formString(formData, "role") as TournamentMemberRole;
  return MEMBER_ROLES.has(role) ? role : "VIEWER";
}

export async function addTournamentMemberAction(
  tournamentId: string,
  formData: FormData,
): Promise<ActionResult> {
  const result = await withActor((actor) =>
    new TournamentMemberService(getDb()).addByUsername(
      actor,
      tournamentId,
      formString(formData, "username"),
      memberRole(formData),
    ),
  );
  if (result.ok) {
    revalidatePath(`/admin/tournaments/${tournamentId}/members`);
  }
  return result;
}

export async function updateTournamentMemberAction(
  tournamentId: string,
  userId: string,
  formData: FormData,
): Promise<void> {
  const result = await withActor((actor) =>
    new TournamentMemberService(getDb()).updateRole(
      actor,
      tournamentId,
      userId,
      memberRole(formData),
    ),
  );
  if (result.ok) {
    revalidatePath(`/admin/tournaments/${tournamentId}/members`);
  }
}

export async function removeTournamentMemberAction(
  tournamentId: string,
  userId: string,
): Promise<void> {
  await withActor((actor) =>
    new TournamentMemberService(getDb()).remove(actor, tournamentId, userId),
  );
  revalidatePath(`/admin/tournaments/${tournamentId}/members`);
}
