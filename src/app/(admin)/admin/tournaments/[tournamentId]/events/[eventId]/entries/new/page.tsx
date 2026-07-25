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
import { createEntryAction } from "@/features/entries/actions";
import { EntryRegistrationForm } from "@/features/entries/components/entry-registration-form";
import { requireRoleOrRedirect } from "@/lib/auth/require-auth";
import { requiredMemberCount } from "@/core/domain/entry-rules";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tournamentId: string; eventId: string }>;
}) {
  const { tournamentId, eventId } = await params;
  const t = await getTranslations("entries");
  const db = getDb();
  try {
    await new TournamentService(db).getById(tournamentId);
    const event = await new EventService(db).getById(eventId);
    const sectionTitle =
      event.type === "DOUBLES"
        ? t("registerPair")
        : event.type === "SINGLES"
          ? t("registerPlayer")
          : t("registerTeam");
    return pageTitle(sectionTitle, event.name);
  } catch {
    return pageTitle(t("title"));
  }
}

export const dynamic = "force-dynamic";

export default async function NewEntryPage({
  params,
}: {
  params: Promise<{ tournamentId: string; eventId: string }>;
}) {
  await requireRoleOrRedirect(["ADMIN", "OPERATOR"]);
  const { tournamentId, eventId } = await params;
  const db = getDb();
  const t = await getTranslations("entries");

  let event;
  try {
    await new TournamentService(db).getById(tournamentId);
    event = await new EventService(db).getById(eventId);
  } catch {
    notFound();
  }

  if (event.status !== "SETUP" && event.status !== "DRAW_READY") {
    notFound();
  }

  const [players, clubs, registeredPlayerIds] = await Promise.all([
    new PlayerService(db).list(),
    new ClubService(db).list(),
    new EntryService(db).listRegisteredPlayerIds(eventId),
  ]);
  const taken = new Set(registeredPlayerIds);
  const availablePlayers = players.filter((p) => !taken.has(p.id));

  const title =
    event.type === "DOUBLES"
      ? t("registerPair")
      : event.type === "SINGLES"
        ? t("registerPlayer")
        : t("registerTeam");

  const hint =
    event.type === "DOUBLES"
      ? t("doublesRequiresPair")
      : event.type === "TEAM"
        ? t("teamRequiresOne")
        : t("singlesRequiresOne", {
            count: requiredMemberCount(event.type),
          });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href={`/admin/tournaments/${tournamentId}/events/${eventId}/entries`}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← {event.type === "DOUBLES" ? t("pairsTitle") : t("title")}
        </Link>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {title} · {event.name}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{hint}</p>
      </div>

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
        action={createEntryAction.bind(null, tournamentId, eventId)}
        submitLabel={
          event.type === "DOUBLES" ? t("savePair") : t("createEntry")
        }
      />
    </div>
  );
}
