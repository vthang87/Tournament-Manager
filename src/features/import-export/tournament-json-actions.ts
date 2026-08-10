"use server";

import { revalidatePath } from "next/cache";
import { TournamentJsonService } from "@/application/services";
import { ValidationError } from "@/application/errors";
import { getDb, getPool } from "@/db/client";
import { withActor } from "@/features/shared/action-utils";

export async function exportTournamentJsonAction(tournamentId: string) {
  return withActor(async (actor) => {
    const result = await new TournamentJsonService(
      getDb(),
      getPool(),
    ).exportTournament(actor, tournamentId);
    return {
      filename: result.filename,
      base64: Buffer.from(result.json, "utf8").toString("base64"),
    };
  });
}

export async function importTournamentJsonAction(formData: FormData) {
  return withActor(async (actor) => {
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ValidationError("Choose a tournament JSON file");
    }
    const result = await new TournamentJsonService(
      getDb(),
      getPool(),
    ).importTournament(actor, Buffer.from(await file.arrayBuffer()));
    revalidatePath("/admin");
    revalidatePath("/admin/tournaments");
    revalidatePath(`/admin/tournaments/${result.tournamentId}`);
    revalidatePath(`/t/${result.tournamentSlug}`);
    return result;
  });
}
