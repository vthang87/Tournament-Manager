import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  ClubService,
  EntryService,
  EventService,
  PlayerService,
  TournamentService,
} from "@/application/services";
import { getDb } from "@/db/client";
import { updateEntryAction } from "@/features/entries/actions";
import { EntryRegistrationForm } from "@/features/entries/components/entry-registration-form";
import { requireRoleOrRedirect } from "@/lib/auth/require-auth";

export const dynamic = "force-dynamic";

export default async function EditEntryPage({
  params,
}: {
  params: Promise<{
    tournamentId: string;
    eventId: string;
    entryId: string;
  }>;
}) {
  await requireRoleOrRedirect(["ADMIN", "OPERATOR"]);
  const { tournamentId, eventId, entryId } = await params;
  const db = getDb();
  const t = await getTranslations("entries");
  const tc = await getTranslations("common");

  let event;
  let entry;
  try {
    await new TournamentService(db).getById(tournamentId);
    event = await new EventService(db).getById(eventId);
    entry = await new EntryService(db).getById(entryId);
  } catch {
    notFound();
  }

  const [players, clubs, registeredPlayerIds] = await Promise.all([
    new PlayerService(db).list(),
    new ClubService(db).list(),
    new EntryService(db).listRegisteredPlayerIds(eventId, entryId),
  ]);
  const taken = new Set(registeredPlayerIds);
  const availablePlayers = players.filter((p) => !taken.has(p.id));

  const membersSorted = [...entry.members].sort(
    (a, b) => a.position - b.position,
  );
  const canEdit =
    entry.status === "ACTIVE" &&
    (event.status === "SETUP" || event.status === "DRAW_READY");
  const isDoubles = event.type === "DOUBLES";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href={`/admin/tournaments/${tournamentId}/events/${eventId}/entries`}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← {isDoubles ? t("pairsTitle") : t("title")}
        </Link>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {isDoubles ? t("editPair") : t("editEntry")}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{entry.status}</p>
      </div>

      {canEdit ? (
        <EntryRegistrationForm
          eventType={event.type}
          players={availablePlayers.map((p) => ({
            id: p.id,
            displayName: p.displayName,
            clubName: p.clubId
              ? (clubs.find((c) => c.id === p.clubId)?.name ?? null)
              : null,
          }))}
          clubs={clubs.map((c) => ({ id: c.id, name: c.name }))}
          action={updateEntryAction.bind(
            null,
            tournamentId,
            eventId,
            entryId,
          )}
          defaults={{
            displayName: entry.displayName,
            seed: entry.seed,
            ranking: entry.ranking,
            clubId: entry.clubId,
            memberPlayerIds: membersSorted.map((m) => m.playerId),
          }}
          submitLabel={isDoubles ? t("updatePair") : tc("save")}
        />
      ) : (
        <p className="text-sm text-slate-600">{t("notEditable")}</p>
      )}
    </div>
  );
}
