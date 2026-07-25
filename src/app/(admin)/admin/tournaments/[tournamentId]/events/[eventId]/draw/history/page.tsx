import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  ClubService,
  DrawService,
  EntryService,
  EventService,
  StageService,
  TournamentService,
} from "@/application/services";
import type { DrawConfigurationSnapshot } from "@/application/services/draw-service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DrawBoard } from "@/features/draw/components/draw-board";
import { DrawHistoryList } from "@/features/draw/components/draw-history-list";
import { getDb } from "@/db/client";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tournamentId: string; eventId: string }>;
}) {
  const { tournamentId, eventId } = await params;
  const t = await getTranslations("draw");
  const db = getDb();
  try {
    await new TournamentService(db).getById(tournamentId);
    const event = await new EventService(db).getById(eventId);
    return pageTitle(t("historyTitle"), event.name);
  } catch {
    return pageTitle(t("historyTitle"));
  }
}

export const dynamic = "force-dynamic";

export default async function DrawHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ tournamentId: string; eventId: string }>;
  searchParams: Promise<{ sessionId?: string }>;
}) {
  const { tournamentId, eventId } = await params;
  const { sessionId } = await searchParams;
  const db = getDb();
  const t = await getTranslations("draw");

  let tournament;
  let event;
  try {
    tournament = await new TournamentService(db).getById(tournamentId);
    event = await new EventService(db).getById(eventId);
  } catch {
    notFound();
  }

  if (event.tournamentId !== tournamentId) {
    notFound();
  }

  const stages = await new StageService(db).listByEvent(eventId);
  const groupStage = stages.find((s) => s.format === "GROUP");
  const draws = new DrawService(db);
  const sessions = groupStage
    ? await draws.listSessionsByStageId(groupStage.id)
    : [];

  const selected =
    (sessionId
      ? sessions.find((s) => s.id === sessionId)
      : sessions.find((s) => s.status === "LOCKED" || s.status === "CONFIRMED")) ??
    sessions[0] ??
    null;

  const groups = groupStage ? await draws.listGroups(groupStage.id) : [];
  const results = selected ? await draws.listResults(selected.id) : [];
  const entries = (await new EntryService(db).listByEvent(eventId)).filter(
    (e) => e.status === "ACTIVE",
  );
  const clubs = await new ClubService(db).list();
  const clubById = new Map(clubs.map((c) => [c.id, c]));

  let capacityPerGroup = 4;
  if (selected) {
    try {
      const snapshot = JSON.parse(
        selected.configurationSnapshotJson,
      ) as DrawConfigurationSnapshot;
      capacityPerGroup = snapshot.capacityPerGroup;
    } catch {
      // keep default
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/tournaments/${tournamentId}/events/${eventId}/draw`}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← {t("title")}
        </Link>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {t("historyTitle")}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {tournament.name} · {event.name} · {t("historySubtitle")}
        </p>
      </div>

      <DrawHistoryList
        tournamentId={tournamentId}
        eventId={eventId}
        sessions={sessions}
        activeSessionId={selected?.id}
      />

      {selected ? (
        <DrawBoard
          tournamentId={tournamentId}
          eventId={eventId}
          stageId={selected.stageId}
          sessionId={selected.id}
          sessionStatus={selected.status}
          groups={groups.map((g) => ({
            id: g.id,
            name: g.name,
            code: g.code,
          }))}
          results={results}
          entries={entries.map((e) => {
            const club = e.clubId ? clubById.get(e.clubId) : undefined;
            return {
              id: e.id,
              displayName: e.displayName,
              seed: e.seed,
              clubId: e.clubId,
              clubCode: club?.shortName ?? null,
              clubName: club?.name ?? null,
            };
          })}
          capacityPerGroup={capacityPerGroup}
          canEdit={false}
          canGenerateMatches={false}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("noSessions")}</CardTitle>
            <CardDescription>{t("generateFirst")}</CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      )}
    </div>
  );
}
