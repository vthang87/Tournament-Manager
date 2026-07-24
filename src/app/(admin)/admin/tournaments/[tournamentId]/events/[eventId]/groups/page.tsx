import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  EntryService,
  EventService,
  StageService,
  StandingsService,
  TournamentService,
} from "@/application/services";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDb } from "@/db/client";
import { DrizzleMatchRepository } from "@/db/repositories/match-repository";
import { DrizzleGroupRepository } from "@/db/repositories/schedule-repository";
import { entryLabel, scoreLine } from "@/features/matches/match-utils";
import { matchStatusKey } from "@/i18n/status-labels";
import { StandingsTable } from "@/features/standings/standings-table";

export const dynamic = "force-dynamic";

export default async function EventGroupsPage({
  params,
}: {
  params: Promise<{ tournamentId: string; eventId: string }>;
}) {
  const { tournamentId, eventId } = await params;
  const db = getDb();
  const t = await getTranslations("groups");
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

  const stages = await new StageService(db).listByEvent(eventId);
  const groupStages = stages.filter((s) => s.format === "GROUP");
  const entries = await new EntryService(db).listByEvent(eventId);
  const labels = new Map(entries.map((e) => [e.id, e.displayName]));
  const labelsRecord = Object.fromEntries(labels);

  const groupRepo = new DrizzleGroupRepository(db);
  const matchesRepo = new DrizzleMatchRepository(db);
  const standings = new StandingsService(db);

  const basePath = `/admin/tournaments/${tournamentId}/events/${eventId}`;

  type GroupBlock = {
    stageName: string;
    group: Awaited<ReturnType<typeof groupRepo.listByStageId>>[number];
    members: Awaited<ReturnType<typeof groupRepo.listEntries>>;
    fixtures: Awaited<ReturnType<typeof matchesRepo.listByGroupId>>;
    setsByMatch: Map<
      string,
      Awaited<ReturnType<typeof matchesRepo.listSets>>
    >;
    standingsResult:
      | Awaited<ReturnType<typeof standings.calculateForGroup>>
      | null;
    standingsError: string | null;
  };

  const blocks: GroupBlock[] = [];

  for (const stage of groupStages) {
    const groups = await groupRepo.listByStageId(stage.id);
    for (const group of groups) {
      const members = await groupRepo.listEntries(group.id);
      const fixtures = await matchesRepo.listByGroupId(group.id);
      const setsByMatch = new Map(
        await Promise.all(
          fixtures.map(async (m) => {
            const sets = await matchesRepo.listSets(m.id);
            return [m.id, sets] as const;
          }),
        ),
      );

      let standingsResult: GroupBlock["standingsResult"] = null;
      let standingsError: string | null = null;
      try {
        standingsResult = await standings.calculateForGroup(group.id, {
          eventId,
        });
      } catch (err) {
        standingsError =
          err instanceof Error ? err.message : t("failedStandings");
      }

      blocks.push({
        stageName: stage.name,
        group,
        members,
        fixtures,
        setsByMatch,
        standingsResult,
        standingsError,
      });
    }
  }

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
            {tournament.name} · {t("subtitle")}
          </p>
        </div>
        <Link href={`${basePath}/matches`}>
          <Button type="button" variant="outline" size="sm">
            {tc("allMatches")}
          </Button>
        </Link>
      </div>

      {groupStages.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
          {t("noGroupStage")}
        </p>
      ) : blocks.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
          {t("noGroupsYet")}
        </p>
      ) : (
        <div className="space-y-8">
          {blocks.map((block) => {
            const completed = block.fixtures.filter(
              (m) =>
                m.status === "COMPLETED" || m.status === "WALKOVER",
            );
            const pending = block.fixtures.filter(
              (m) =>
                m.status === "PENDING" ||
                m.status === "SCHEDULED" ||
                m.status === "IN_PROGRESS",
            );

            return (
              <Card key={block.group.id}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {block.group.name}
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      {block.stageName}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    {t("cardDesc", {
                      entries: block.members.length,
                      results: completed.length,
                      open: pending.length,
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-slate-900">
                      {t("standings")}
                    </h3>
                    {block.standingsError ? (
                      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                        {block.standingsError}
                      </p>
                    ) : block.standingsResult ? (
                      <StandingsTable
                        rows={block.standingsResult.rows}
                        labels={labelsRecord}
                      />
                    ) : (
                      <p className="text-sm text-slate-500">{tc("loading")}</p>
                    )}
                    {block.standingsResult ? (
                      <p className="mt-2 text-xs text-slate-500">
                        {t("criteriaPrefix")}
                        {block.standingsResult.rule.criteria.join(" → ")}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-slate-900">
                      {t("fixturesResults")}
                    </h3>
                    {block.fixtures.length === 0 ? (
                      <p className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
                        {t("noFixturesGroup")}
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{tc("round")}</TableHead>
                            <TableHead>{tc("fixture")}</TableHead>
                            <TableHead>{tc("score")}</TableHead>
                            <TableHead>{tc("status")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {block.fixtures.map((match) => {
                            const sets =
                              block.setsByMatch.get(match.id) ?? [];
                            return (
                              <TableRow key={match.id}>
                                <TableCell className="tabular-nums">
                                  {match.roundNumber}
                                </TableCell>
                                <TableCell>
                                  <Link
                                    href={`${basePath}/matches/${match.id}`}
                                    className="font-medium underline"
                                  >
                                    {entryLabel(match.entryAId, labels)}{" "}
                                    {tc("vs")}{" "}
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
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
