import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  EntryService,
  EventService,
  StageService,
  TournamentService,
} from "@/application/services";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MatchStatus } from "@/core/domain";
import { getDb } from "@/db/client";
import { DrizzleMatchRepository } from "@/db/repositories/match-repository";
import { DrizzleGroupRepository } from "@/db/repositories/schedule-repository";
import { generateRoundRobinMatchesAction } from "@/features/matches/actions";
import { GenerateMatchesButton } from "@/features/matches/generate-matches-button";
import { entryLabel, scoreLine } from "@/features/matches/match-utils";
import { matchStatusKey } from "@/i18n/status-labels";
import { canPerform } from "@/lib/auth/policies";
import { getCurrentUser } from "@/lib/auth/require-auth";

export const dynamic = "force-dynamic";

const STATUSES: MatchStatus[] = [
  "PENDING",
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "WALKOVER",
  "CANCELLED",
];

export default async function EventMatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ tournamentId: string; eventId: string }>;
  searchParams: Promise<{
    group?: string;
    round?: string;
    status?: string;
  }>;
}) {
  const { tournamentId, eventId } = await params;
  const filters = await searchParams;
  const db = getDb();
  const t = await getTranslations("matches");
  const tc = await getTranslations("common");
  const tStatus = await getTranslations("status");

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

  const matchesRepo = new DrizzleMatchRepository(db);
  const groupRepo = new DrizzleGroupRepository(db);

  const [stages, entries, matchRows] = await Promise.all([
    new StageService(db).listByEvent(eventId),
    new EntryService(db).listByEvent(eventId),
    matchesRepo.listByEventId(eventId),
  ]);

  const groupStages = stages.filter((s) => s.format === "GROUP");
  const groupsByStage = await Promise.all(
    groupStages.map(async (stage) => ({
      stage,
      groups: await groupRepo.listByStageId(stage.id),
    })),
  );
  const allGroups = groupsByStage.flatMap((g) => g.groups);
  const groupName = new Map(allGroups.map((g) => [g.id, g.name]));
  const labels = new Map(entries.map((e) => [e.id, e.displayName]));

  const setsByMatch = new Map(
    await Promise.all(
      matchRows.map(async (m) => {
        const sets = await matchesRepo.listSets(m.id);
        return [m.id, sets] as const;
      }),
    ),
  );

  let filtered = matchRows;
  if (filters.group) {
    filtered = filtered.filter((m) => m.groupId === filters.group);
  }
  if (filters.round) {
    const round = Number(filters.round);
    if (Number.isFinite(round)) {
      filtered = filtered.filter((m) => m.roundNumber === round);
    }
  }
  if (filters.status && STATUSES.includes(filters.status as MatchStatus)) {
    filtered = filtered.filter((m) => m.status === filters.status);
  }

  filtered = [...filtered].sort((a, b) => {
    if (a.roundNumber !== b.roundNumber) {
      return a.roundNumber - b.roundNumber;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });

  const rounds = [
    ...new Set(matchRows.map((m) => m.roundNumber)),
  ].sort((a, b) => a - b);

  const user = await getCurrentUser();
  const canDraw = user ? canPerform(user.role, "draw") : false;
  const canGenerate =
    canDraw &&
    (event.status === "DRAW_CONFIRMED" || event.status === "IN_PROGRESS");

  const basePath = `/admin/tournaments/${tournamentId}/events/${eventId}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={basePath}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            ← {event.name}
          </Link>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {tournament.name} · {t("fixturesCount", { count: filtered.length })}
          </p>
        </div>
        <Link href={`${basePath}/groups`}>
          <Button type="button" variant="outline" size="sm">
            {t("groupsStandings")}
          </Button>
        </Link>
      </div>

      {canGenerate && groupStages.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-slate-900">
            {t("generateRR")}
          </p>
          <div className="flex flex-wrap gap-3">
            {groupStages.map((stage) => (
              <GenerateMatchesButton
                key={stage.id}
                tournamentId={tournamentId}
                eventId={eventId}
                stageId={stage.id}
                stageName={stage.name}
                action={generateRoundRobinMatchesAction}
              />
            ))}
          </div>
        </div>
      ) : null}

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500" htmlFor="group">
            {t("filterGroup")}
          </label>
          <Select id="group" name="group" defaultValue={filters.group ?? ""}>
            <option value="">{tc("all")}</option>
            {allGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500" htmlFor="round">
            {t("filterRound")}
          </label>
          <Select id="round" name="round" defaultValue={filters.round ?? ""}>
            <option value="">{tc("all")}</option>
            {rounds.map((r) => (
              <option key={r} value={String(r)}>
                {r}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label
            className="text-xs font-medium text-slate-500"
            htmlFor="status"
          >
            {t("filterStatus")}
          </label>
          <Select
            id="status"
            name="status"
            defaultValue={filters.status ?? ""}
          >
            <option value="">{tc("all")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {tStatus(matchStatusKey(s))}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" size="sm">
          {tc("filter")}
        </Button>
        <Link
          href={`${basePath}/matches`}
          className="text-sm text-slate-600 underline"
        >
          {tc("clear")}
        </Link>
      </form>

      {matchRows.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
          {t("noMatchesYet")}
          {canGenerate ? t("generateHint") : t("waitForDraw")}
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
          {t("noFilterMatch")}
        </p>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tc("round")}</TableHead>
                <TableHead>{t("filterGroup")}</TableHead>
                <TableHead>{tc("fixture")}</TableHead>
                <TableHead>{tc("score")}</TableHead>
                <TableHead>{tc("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((match) => {
                const sets = setsByMatch.get(match.id) ?? [];
                return (
                  <TableRow key={match.id}>
                    <TableCell className="tabular-nums">
                      {match.roundNumber}
                    </TableCell>
                    <TableCell>
                      {match.groupId
                        ? (groupName.get(match.groupId) ?? tc("dash"))
                        : tc("dash")}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`${basePath}/matches/${match.id}`}
                        className="font-medium underline"
                      >
                        {entryLabel(match.entryAId, labels)} {tc("vs")}{" "}
                        {entryLabel(match.entryBId, labels)}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums text-slate-600">
                      {scoreLine(sets)}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-600">
                        {tStatus(matchStatusKey(match.status))}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
