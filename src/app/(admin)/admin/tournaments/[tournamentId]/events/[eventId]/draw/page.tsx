import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  ClubService,
  DrawService,
  EntryService,
  EventService,
  MatchGenerationService,
  StageService,
  TournamentAccessService,
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
import { DrawConfigForm } from "@/features/draw/components/draw-config-form";
import { DrawHistoryList } from "@/features/draw/components/draw-history-list";
import { suggestDrawCapacity } from "@/features/draw/lib/allocations";
import { getDb } from "@/db/client";
import { canPerform } from "@/lib/auth/policies";
import { getCurrentUser } from "@/lib/auth/require-auth";
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
    return pageTitle(t("title"), event.name);
  } catch {
    return pageTitle(t("title"));
  }
}

export const dynamic = "force-dynamic";

export default async function DrawPage({
  params,
}: {
  params: Promise<{ tournamentId: string; eventId: string }>;
}) {
  const { tournamentId, eventId } = await params;
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

  const user = await getCurrentUser();
  if (!user) {
    notFound();
  }
  const actor = { userId: user.id, role: user.role };
  const stages = await new StageService(db).listByEvent(eventId);
  const groupStage = stages.find((s) => s.format === "GROUP");
  const draws = new DrawService(db);
  const entries = (await new EntryService(db).listByEvent(eventId)).filter(
    (e) => e.status === "ACTIVE",
  );
  const clubs = await new ClubService(db).listForTournament(
    actor,
    tournamentId,
  );
  const clubById = new Map(clubs.map((c) => [c.id, c]));

  const sessions = groupStage
    ? await draws.listSessionsByStageId(groupStage.id)
    : [];
  const draft = groupStage
    ? await draws.findDraftByStageId(groupStage.id)
    : null;
  const confirmed = groupStage
    ? await draws.findLatestConfirmedByStageId(groupStage.id)
    : null;
  const activeSession = draft ?? confirmed;

  const groups = groupStage
    ? await draws.listGroups(groupStage.id)
    : [];
  const results = activeSession
    ? await draws.listResults(activeSession.id)
    : [];

  let capacityPerGroup = suggestDrawCapacity(entries.length).capacityPerGroup;
  let configDefaults: {
    groupCount: number;
    capacityPerGroup: number;
    seedDistribution: "NORMAL" | "SERPENTINE";
    avoidSameClub: boolean;
    randomSeed: string;
  } = {
    ...suggestDrawCapacity(entries.length),
    seedDistribution: "NORMAL",
    avoidSameClub: true,
    randomSeed: "seed-1",
  };

  if (activeSession) {
    try {
      const snapshot = JSON.parse(
        activeSession.configurationSnapshotJson,
      ) as DrawConfigurationSnapshot;
      capacityPerGroup = snapshot.capacityPerGroup;
      configDefaults = {
        groupCount: snapshot.groupCount,
        capacityPerGroup: snapshot.capacityPerGroup,
        seedDistribution: snapshot.seedDistribution,
        avoidSameClub: snapshot.avoidSameClub,
        randomSeed: activeSession.randomSeed,
      };
    } catch {
      // keep suggested defaults
    }
  }

  const access = await new TournamentAccessService(db).resolve(
    actor,
    tournamentId,
  );
  const canDraw = canPerform(access.role, "draw");
  const canEdit =
    canDraw &&
    event.status === "DRAW_READY" &&
    !!draft &&
    !confirmed;
  const canConfigure =
    canDraw && event.status === "DRAW_READY" && !confirmed;
  const canGenerateMatches =
    canDraw &&
    !!confirmed &&
    (event.status === "DRAW_CONFIRMED" || event.status === "IN_PROGRESS");

  let matchCount = 0;
  if (groupStage && confirmed) {
    matchCount = (
      await new MatchGenerationService(db).listByStage(groupStage.id)
    ).length;
  }

  const entryViews = entries.map((e) => {
    const club = e.clubId ? clubById.get(e.clubId) : undefined;
    return {
      id: e.id,
      displayName: e.displayName,
      seed: e.seed,
      clubId: e.clubId,
      clubCode: club?.shortName ?? null,
      clubName: club?.name ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/admin/tournaments/${tournamentId}/events/${eventId}`}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            ← {event.name}
          </Link>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {tournament.name} · event{" "}
            <span className="font-medium text-slate-800">{event.status}</span>
            {groupStage ? ` · ${groupStage.name}` : ""}
          </p>
          {event.type === "DOUBLES" ? (
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              {t.rich("doublesNote", {
                count: entries.length,
                pair: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
          ) : null}
        </div>
        <Link
          href={`/admin/tournaments/${tournamentId}/events/${eventId}/draw/history`}
          className="text-sm font-medium text-slate-700 underline"
        >
          {t("history")}
        </Link>
      </div>

      {!groupStage ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("noGroupStage")}
        </div>
      ) : null}

      {event.status === "SETUP" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("needDrawReady")}
        </div>
      ) : null}

      {groupStage && canConfigure ? (
        <DrawConfigForm
          tournamentId={tournamentId}
          eventId={eventId}
          stageId={groupStage.id}
          defaults={configDefaults}
          disabled={!canDraw}
        />
      ) : null}

      {groupStage && activeSession ? (
        <DrawBoard
          tournamentId={tournamentId}
          eventId={eventId}
          stageId={groupStage.id}
          sessionId={activeSession.id}
          sessionStatus={activeSession.status}
          groups={groups.map((g) => ({
            id: g.id,
            name: g.name,
            code: g.code,
          }))}
          results={results}
          entries={entryViews}
          capacityPerGroup={capacityPerGroup}
          canEdit={canEdit}
          canGenerateMatches={canGenerateMatches}
        />
      ) : groupStage && event.status === "DRAW_READY" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("noDraft")}</CardTitle>
            <CardDescription>{t("noDraftHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              {t("entriesReady", { count: entries.length })}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {confirmed && matchCount > 0 ? (
        <p className="text-sm text-slate-600">
          {t("matchesPresent", { count: matchCount })}
        </p>
      ) : null}

      {sessions.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">{t("recentSessions")}</h3>
          <DrawHistoryList
            tournamentId={tournamentId}
            eventId={eventId}
            sessions={sessions.slice(0, 5)}
            activeSessionId={activeSession?.id}
          />
        </div>
      ) : null}
    </div>
  );
}
