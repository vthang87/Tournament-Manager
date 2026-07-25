import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  EntryService,
  EventService,
  TournamentService,
  CourtService,
  createMatchOpsService,
} from "@/application/services";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DrizzleGroupRepository } from "@/db/repositories/schedule-repository";
import { DrizzleMatchRepository } from "@/db/repositories/match-repository";
import { getDb } from "@/db/client";
import {
  callToCourtAction,
  cancelMatchAction,
  clearWarmupAction,
  correctScoreAction,
  enterScoreAction,
  resolveSpecialAction,
  saveLiveScoreAction,
  startMatchAction,
  swapSidesAction,
} from "@/features/matches/actions";
import { MatchOpsPanel } from "@/features/matches/match-ops-panel";
import {
  entryLabel,
  formatRuleSummary,
  parseRuleSnapshot,
  scoreLine,
} from "@/features/matches/match-utils";
import { matchStatusKey } from "@/i18n/status-labels";
import { canPerform } from "@/lib/auth/policies";
import { getCurrentUser } from "@/lib/auth/require-auth";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata({
  params,
}: {
  params: Promise<{
    tournamentId: string;
    eventId: string;
    matchId: string;
  }>;
}) {
  const { tournamentId, eventId, matchId } = await params;
  const t = await getTranslations("matches");
  const tc = await getTranslations("common");
  const db = getDb();
  try {
    await new TournamentService(db).getById(tournamentId);
    const event = await new EventService(db).getById(eventId);
    const match = await createMatchOpsService(db).getById(matchId);
    if (event.tournamentId !== tournamentId || match.eventId !== eventId) {
      return pageTitle(t("title"), event.name);
    }
    const entries = await new EntryService(db).listByEvent(eventId);
    const labels = new Map(entries.map((e) => [e.id, e.displayName]));
    const labelA = entryLabel(match.entryAId, labels);
    const labelB = entryLabel(match.entryBId, labels);
    return pageTitle(`${labelA} ${tc("vs")} ${labelB}`, t("title"));
  } catch {
    return pageTitle(t("title"));
  }
}

export const dynamic = "force-dynamic";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{
    tournamentId: string;
    eventId: string;
    matchId: string;
  }>;
}) {
  const { tournamentId, eventId, matchId } = await params;
  const db = getDb();
  const t = await getTranslations("matches");
  const tc = await getTranslations("common");
  const tStatus = await getTranslations("status");

  let tournament;
  let event;
  let match;
  try {
    tournament = await new TournamentService(db).getById(tournamentId);
    event = await new EventService(db).getById(eventId);
    match = await createMatchOpsService(db).getById(matchId);
  } catch {
    notFound();
  }

  if (event.tournamentId !== tournamentId || match.eventId !== eventId) {
    notFound();
  }

  const entries = await new EntryService(db).listByEvent(eventId);
  const courts = await new CourtService(db).listByTournament(tournamentId);
  const busyCourtIds = new Set(
    await new DrizzleMatchRepository(db).listBusyCourtIdsForTournament(
      tournamentId,
      match.id,
    ),
  );
  const labels = new Map(entries.map((e) => [e.id, e.displayName]));
  const labelA = entryLabel(match.entryAId, labels);
  const labelB = entryLabel(match.entryBId, labels);
  const court = match.courtId
    ? (courts.find((c) => c.id === match.courtId) ?? null)
    : null;

  let groupName: string | null = null;
  if (match.groupId) {
    const group = await new DrizzleGroupRepository(db).findById(match.groupId);
    groupName = group?.name ?? null;
  }

  let ruleSummary = t("ruleUnavailable");
  let rule;
  try {
    rule = parseRuleSnapshot(match.ruleSnapshotJson);
    ruleSummary = formatRuleSummary(rule, t);
  } catch {
    rule = null;
  }

  const user = await getCurrentUser();
  const canScore = user ? canPerform(user.role, "score") : false;
  const canCorrect = user ? canPerform(user.role, "correct") : false;

  const basePath = `/admin/tournaments/${tournamentId}/events/${eventId}`;
  const bothSides = Boolean(match.entryAId && match.entryBId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`${basePath}/matches`}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          {t("backToMatches")}
        </Link>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {labelA} {tc("vs")} {labelB}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {tournament.name} · {event.name}
          {groupName ? ` · ${groupName}` : ""} · {tc("round")}{" "}
          {match.roundNumber}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("statusLabel")}</CardTitle>
          <CardDescription>
            <span className="font-medium text-slate-800">
              {tStatus(matchStatusKey(match.status))}
            </span>
            {match.resolution ? ` · ${match.resolution}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-slate-500">{t("courtLabel")}</span>
            <span className="font-medium text-slate-800">
              {court
                ? t("courtOption", { name: court.name, code: court.code })
                : t("courtUnassigned")}
            </span>
          </p>
          <p>
            <span className="text-slate-500">{t("scoreLabel")}</span>
            <span className="tabular-nums font-medium">
              {scoreLine(match.sets)}
            </span>
          </p>
          {match.winnerEntryId ? (
            <p>
              <span className="text-slate-500">{t("winnerLabel")}</span>
              {entryLabel(match.winnerEntryId, labels)}
            </p>
          ) : null}
          <p className="text-slate-600">{ruleSummary}</p>
        </CardContent>
      </Card>

      {!bothSides ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("entriesRequired")}
        </p>
      ) : rule ? (
        <MatchOpsPanel
          tournamentId={tournamentId}
          eventId={eventId}
          matchId={match.id}
          status={match.status}
          expectedUpdatedAt={match.updatedAt}
          entryAId={match.entryAId!}
          entryBId={match.entryBId!}
          labelA={labelA}
          labelB={labelB}
          courtId={match.courtId}
          courts={courts
            .filter((c) => c.active || c.id === match.courtId)
            .map((c) => ({
              id: c.id,
              name: c.name,
              code: c.code,
              busy: busyCourtIds.has(c.id),
            }))}
          rule={rule}
          canScore={canScore}
          canCorrect={canCorrect}
          warmupUntil={match.warmupUntil}
          initialSets={match.sets.map((s) => ({
            setNumber: s.setNumber,
            scoreA: s.scoreA,
            scoreB: s.scoreB,
          }))}
          startAction={startMatchAction}
          callToCourtAction={callToCourtAction}
          clearWarmupAction={clearWarmupAction}
          swapSidesAction={swapSidesAction}
          enterScoreAction={enterScoreAction}
          saveLiveScoreAction={saveLiveScoreAction}
          resolveSpecialAction={resolveSpecialAction}
          cancelMatchAction={cancelMatchAction}
          correctScoreAction={correctScoreAction}
        />
      ) : (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {t("cannotScore")}
        </p>
      )}
    </div>
  );
}
