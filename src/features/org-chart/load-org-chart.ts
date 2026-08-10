import type { AppDatabase } from "@/db/client";
import {
  CourtService,
  DrawService,
  EntryService,
  EventService,
  StageService,
  TournamentService,
} from "@/application/services";
import { DrizzleDrawRepository } from "@/db/repositories/draw-repository";
import { DrizzleMatchRepository } from "@/db/repositories/match-repository";
import { buildBracketBoardView } from "@/features/bracket/lib/build-bracket-view";
import { localizeStageName } from "@/features/stages/localize-stage-name";
import { buildGroupStageSummaryNode } from "./build-match-tree";
import type {
  MatchOrgChartEvent,
  OrgChartNode,
  TournamentOrgChartData,
} from "./types";

type Translate = (key: string, values?: Record<string, string | number>) => string;

export async function loadTournamentOrgChart(
  db: AppDatabase,
  tournamentId: string,
  labels: {
    tStatus: Translate;
    tStages: Translate;
    tOrg: Translate;
    tc: Translate;
    tournamentStatusKey: (s: string) => string;
    eventStatusKey: (s: string) => string;
    stageStatusKey: (s: string) => string;
  },
): Promise<TournamentOrgChartData> {
  const tournament = await new TournamentService(db).getById(tournamentId);
  const events = await new EventService(db).listByTournament(tournamentId);
  const courts = await new CourtService(db).listByTournament(tournamentId);
  const stagesSvc = new StageService(db);
  const draws = new DrawService(db);
  const matchRepo = new DrizzleMatchRepository(db);

  const eventNodes: OrgChartNode[] = [];
  for (const event of events) {
    const stages = await stagesSvc.listByEvent(event.id);
    const stageNodes: OrgChartNode[] = [];

    for (const stage of stages) {
      const stageName = localizeStageName(stage.name, labels.tStages);
      if (stage.format === "GROUP") {
        const groups = await draws.listGroups(stage.id);
        const stageMatches = await matchRepo.listByStageId(stage.id);
        stageNodes.push(
          buildGroupStageSummaryNode({
            stage,
            groups,
            matches: stageMatches,
            tournamentId,
            eventId: event.id,
            labels: {
              groupStage: stageName || labels.tOrg("groupStage"),
              group: labels.tOrg("group"),
              matchesCount: (done, total) =>
                labels.tOrg("matchesProgress", { done, total }),
            },
          }),
        );
      } else {
        const koMatches = await matchRepo.listKnockoutByStage(stage.id);
        const pending = koMatches.filter(
          (m) => m.status === "PENDING" || m.status === "SCHEDULED",
        ).length;
        stageNodes.push({
          id: `stage-${stage.id}`,
          label: stageName || labels.tOrg("knockout"),
          sublabel: labels.tOrg("knockoutMatches", {
            total: koMatches.length,
            open: pending,
          }),
          status: labels.tStatus(labels.stageStatusKey(stage.status)),
          tone: "stage",
          href: `/admin/tournaments/${tournamentId}/events/${event.id}/bracket`,
        });
      }
    }

    eventNodes.push({
      id: `event-${event.id}`,
      label: event.name,
      sublabel: `${event.type} · ${event.genderCategory}`,
      status: labels.tStatus(labels.eventStatusKey(event.status)),
      tone: "event",
      href: `/admin/tournaments/${tournamentId}/events/${event.id}`,
      children: stageNodes.length > 0 ? stageNodes : undefined,
    });
  }

  const courtNode: OrgChartNode | null =
    courts.length > 0
      ? {
          id: "courts",
          label: labels.tOrg("courtsNode", { count: courts.length }),
          sublabel: courts.map((c) => c.code).join(" · "),
          tone: "court",
          href: `/admin/tournaments/${tournamentId}/courts`,
        }
      : null;

  const children = [
    ...(courtNode ? [courtNode] : []),
    ...eventNodes,
  ];

  return {
    tournamentId,
    tournamentName: tournament.name,
    tree: {
      id: `tournament-${tournament.id}`,
      label: tournament.name,
      sublabel: tournament.slug,
      status: labels.tStatus(labels.tournamentStatusKey(tournament.status)),
      tone: "root",
      href: `/admin/tournaments/${tournamentId}`,
      children: children.length > 0 ? children : undefined,
    },
  };
}

export async function loadMatchOrgCharts(
  db: AppDatabase,
  tournamentId: string,
  labels: {
    tStatus: Translate;
    tStages: Translate;
    tOrg: Translate;
    tc: Translate;
  },
): Promise<MatchOrgChartEvent[]> {
  const events = await new EventService(db).listByTournament(tournamentId);
  const stagesSvc = new StageService(db);
  const draws = new DrawService(db);
  const drawRepo = new DrizzleDrawRepository(db);
  const matchRepo = new DrizzleMatchRepository(db);
  const entrySvc = new EntryService(db);

  const result: MatchOrgChartEvent[] = [];

  for (const event of events) {
    const stages = await stagesSvc.listByEvent(event.id);
    const groupStage = stages.find((s) => s.format === "GROUP") ?? null;
    const knockoutStage = stages.find((s) => s.format === "KNOCKOUT") ?? null;
    const entries = await entrySvc.listByEvent(event.id);

    let groupSummary: OrgChartNode | null = null;
    if (groupStage) {
      const groups = await draws.listGroups(groupStage.id);
      const stageMatches = await matchRepo.listByStageId(groupStage.id);
      const stageName = localizeStageName(groupStage.name, labels.tStages);
      groupSummary = buildGroupStageSummaryNode({
        stage: groupStage,
        groups,
        matches: stageMatches,
        tournamentId,
        eventId: event.id,
        labels: {
          groupStage: stageName || labels.tOrg("groupStage"),
          group: labels.tOrg("group"),
          matchesCount: (done, total) =>
            labels.tOrg("matchesProgress", { done, total }),
        },
      });
    }

    let board: MatchOrgChartEvent["board"] = null;
    let dropFromMatchIds: string[] = [];
    if (knockoutStage) {
      const koMatches = await matchRepo.listKnockoutByStage(knockoutStage.id);
      const withSets = await Promise.all(
        koMatches.map((m) => matchRepo.findByIdWithSets(m.id)),
      );
      const setsByMatchId = new Map(
        withSets
          .filter((m): m is NonNullable<typeof m> => m != null)
          .map((m) => [m.id, m.sets]),
      );

      const groups = groupStage ? await draws.listGroups(groupStage.id) : [];
      const groupEntries = groupStage
        ? (await drawRepo.listGroupEntriesByStageId(groupStage.id)).map((ge) => ({
            groupId: ge.groupId,
            entryId: ge.entryId,
          }))
        : [];

      board = buildBracketBoardView({
        matches: koMatches,
        setsByMatchId,
        entries,
        groups,
        groupEntries,
      });

      const third = koMatches.find((m) => m.isThirdPlace);
      if (third) {
        dropFromMatchIds = koMatches
          .filter((m) => m.loserNextMatchId === third.id)
          .sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0))
          .map((m) => m.id);
      }
    }

    if (groupSummary || board) {
      result.push({
        eventId: event.id,
        eventName: event.name,
        board,
        dropFromMatchIds,
        groupSummary,
      });
    }
  }

  return result;
}
