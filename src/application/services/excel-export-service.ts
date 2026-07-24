import { NotFoundError, ValidationError } from "@/application/errors";
import { PublicViewService } from "@/application/services/public-view-service";
import { StandingsService } from "@/application/services/standings-service";
import type { ActorContext } from "@/core/domain";
import type { AppDatabase } from "@/db/client";
import {
  DrizzleCourtRepository,
  DrizzleDrawRepository,
  DrizzleMatchRepository,
  DrizzleTournamentEventRepository,
  DrizzleTournamentRepository,
} from "@/db/repositories";
import { DrizzleClubRepository } from "@/db/repositories/club-repository";
import { DrizzleEntryRepository } from "@/db/repositories/entry-repository";
import { DrizzleStageRepository } from "@/db/repositories/stage-repository";
import {
  DrizzleGroupRepository,
} from "@/db/repositories/schedule-repository";
import { buildWorkbook } from "@/features/import-export/excel-workbook";
import { EXPORT_MAX_ROWS } from "@/features/import-export/limits";
import { escapeExcelCell } from "@/features/import-export/sanitize";
import { assertCanPerform } from "@/lib/auth/policies";

export type ExportKind =
  | "Participants"
  | "GroupDraw"
  | "Schedule"
  | "Results"
  | "Standings";

export class ExcelExportService {
  private readonly tournaments: DrizzleTournamentRepository;
  private readonly events: DrizzleTournamentEventRepository;
  private readonly entries: DrizzleEntryRepository;
  private readonly clubs: DrizzleClubRepository;
  private readonly courts: DrizzleCourtRepository;
  private readonly stages: DrizzleStageRepository;
  private readonly matches: DrizzleMatchRepository;
  private readonly draw: DrizzleDrawRepository;
  private readonly groups: DrizzleGroupRepository;
  private readonly standings: StandingsService;
  private readonly publicView: PublicViewService;

  constructor(private readonly db: AppDatabase) {
    this.tournaments = new DrizzleTournamentRepository(db);
    this.events = new DrizzleTournamentEventRepository(db);
    this.entries = new DrizzleEntryRepository(db);
    this.clubs = new DrizzleClubRepository(db);
    this.courts = new DrizzleCourtRepository(db);
    this.stages = new DrizzleStageRepository(db);
    this.matches = new DrizzleMatchRepository(db);
    this.draw = new DrizzleDrawRepository(db);
    this.groups = new DrizzleGroupRepository(db);
    this.standings = new StandingsService(db);
    this.publicView = new PublicViewService(db);
  }

  async exportEventWorkbook(
    actor: ActorContext,
    eventId: string,
    kind: ExportKind,
  ): Promise<{ filename: string; buffer: Buffer }> {
    assertCanPerform(actor.role, "view");
    const event = await this.events.findById(eventId);
    if (!event) {
      throw new NotFoundError(`Event ${eventId} not found`);
    }
    const tournament = await this.tournaments.findById(event.tournamentId);
    if (!tournament) {
      throw new NotFoundError(`Tournament ${event.tournamentId} not found`);
    }

    const buffer = await this.buildForEvent(event.id, event.name, kind);
    return {
      filename: `${kind}-${event.name.replace(/[^\w.-]+/g, "_")}.xlsx`,
      buffer,
    };
  }

  async exportTournamentWorkbook(
    actor: ActorContext,
    tournamentId: string,
    kind: ExportKind,
  ): Promise<{ filename: string; buffer: Buffer }> {
    assertCanPerform(actor.role, "view");
    const tournament = await this.tournaments.findById(tournamentId);
    if (!tournament) {
      throw new NotFoundError(`Tournament ${tournamentId} not found`);
    }
    // Aggregate public-safe fields via public view (no PII)
    const view = await this.publicView.getBySlug(tournament.slug);
    const buffer = await this.buildFromPublicView(view, kind);
    return {
      filename: `${kind}-${tournament.slug}.xlsx`,
      buffer,
    };
  }

  private async buildForEvent(
    eventId: string,
    eventName: string,
    kind: ExportKind,
  ): Promise<Buffer> {
    const clubs = await this.clubs.list();
    const clubName = new Map(clubs.map((c) => [c.id, c.name]));
    const entryList = await this.entries.listByEventId(eventId);
    const entryName = new Map(entryList.map((e) => [e.id, e.displayName]));
    const stageList = await this.stages.listByEventId(eventId);

    if (kind === "Participants") {
      const rows = entryList.map((e) => [
        escapeExcelCell(e.displayName),
        escapeExcelCell(e.clubId ? (clubName.get(e.clubId) ?? "") : ""),
        e.seed ?? "",
        escapeExcelCell(e.status),
      ]);
      this.assertRowLimit(rows.length);
      return buildWorkbook(
        "Participants",
        ["Display Name", "Club", "Seed", "Status"],
        rows,
      );
    }

    if (kind === "GroupDraw") {
      const rows: Array<Array<string | number>> = [];
      for (const stage of stageList.filter((s) => s.format === "GROUP")) {
        const groups = await this.draw.listGroupsByStageId(stage.id);
        for (const group of groups) {
          const groupEntries = await this.groups.listEntries(group.id);
          for (const ge of groupEntries) {
            rows.push([
              escapeExcelCell(stage.name),
              escapeExcelCell(group.name),
              escapeExcelCell(group.code),
              ge.position,
              escapeExcelCell(entryName.get(ge.entryId) ?? ge.entryId),
              ge.seedPosition ?? "",
            ]);
          }
        }
      }
      this.assertRowLimit(rows.length);
      return buildWorkbook(
        "GroupDraw",
        ["Stage", "Group", "Code", "Position", "Entry", "Seed Position"],
        rows,
      );
    }

    const matchRows = await this.matches.listByEventId(eventId);
    const eventRecord = await this.events.findById(eventId);
    const courtLookup = new Map<string, string>();
    if (eventRecord) {
      const courtRows = await this.courts.listByTournamentId(
        eventRecord.tournamentId,
      );
      for (const c of courtRows) {
        courtLookup.set(c.id, c.code);
      }
    }

    if (kind === "Schedule" || kind === "Results") {
      const withMeta = await Promise.all(
        matchRows.map(async (m) => {
          const sets = await this.matches.listSets(m.id);
          return { match: m, sets };
        }),
      );

      if (kind === "Schedule") {
        const rows = withMeta.map(({ match }) => [
          escapeExcelCell(eventName),
          match.roundNumber,
          escapeExcelCell(entryName.get(match.entryAId ?? "") ?? ""),
          escapeExcelCell(entryName.get(match.entryBId ?? "") ?? ""),
          escapeExcelCell(match.status),
          escapeExcelCell(match.scheduledAt ?? ""),
          escapeExcelCell(
            match.courtId ? (courtLookup.get(match.courtId) ?? match.courtId) : "",
          ),
        ]);
        this.assertRowLimit(rows.length);
        return buildWorkbook(
          "Schedule",
          [
            "Event",
            "Round",
            "Entry A",
            "Entry B",
            "Status",
            "Scheduled At",
            "Court",
          ],
          rows,
        );
      }

      const rows = withMeta
        .filter(
          ({ match }) =>
            match.status === "COMPLETED" ||
            match.status === "WALKOVER" ||
            match.winnerEntryId,
        )
        .map(({ match, sets }) => [
          escapeExcelCell(eventName),
          escapeExcelCell(entryName.get(match.entryAId ?? "") ?? ""),
          escapeExcelCell(entryName.get(match.entryBId ?? "") ?? ""),
          escapeExcelCell(entryName.get(match.winnerEntryId ?? "") ?? ""),
          escapeExcelCell(match.resolution ?? ""),
          escapeExcelCell(sets.map((s) => `${s.scoreA}-${s.scoreB}`).join(", ")),
          escapeExcelCell(match.completedAt ?? ""),
        ]);
      this.assertRowLimit(rows.length);
      return buildWorkbook(
        "Results",
        [
          "Event",
          "Entry A",
          "Entry B",
          "Winner",
          "Resolution",
          "Sets",
          "Completed At",
        ],
        rows,
      );
    }

    // Standings
    const rows: Array<Array<string | number>> = [];
    for (const stage of stageList.filter((s) => s.format === "GROUP")) {
      const results = await this.standings.calculateForStage(stage.id, {
        eventId,
      });
      const groups = await this.draw.listGroupsByStageId(stage.id);
      const groupName = new Map(groups.map((g) => [g.id, g.name]));
      for (const result of results) {
        for (const row of result.rows) {
          rows.push([
            escapeExcelCell(stage.name),
            escapeExcelCell(groupName.get(result.groupId ?? "") ?? ""),
            row.rank,
            escapeExcelCell(entryName.get(row.entryId) ?? row.entryId),
            row.played,
            row.wins,
            row.losses,
            row.setDifference,
            row.pointDifference,
          ]);
        }
      }
    }
    this.assertRowLimit(rows.length);
    return buildWorkbook(
      "Standings",
      [
        "Stage",
        "Group",
        "Rank",
        "Entry",
        "Played",
        "Wins",
        "Losses",
        "Set Diff",
        "Point Diff",
      ],
      rows,
    );
  }

  private async buildFromPublicView(
    view: Awaited<ReturnType<PublicViewService["getBySlug"]>>,
    kind: ExportKind,
  ): Promise<Buffer> {
    if (kind === "Participants") {
      const rows = Object.entries(view.entriesByEvent).flatMap(
        ([eventId, list]) => {
          const eventName =
            view.events.find((e) => e.id === eventId)?.name ?? eventId;
          return list.map((e) => [
            escapeExcelCell(eventName),
            escapeExcelCell(e.displayName),
            escapeExcelCell(e.clubName ?? ""),
            e.seed ?? "",
            escapeExcelCell(e.status),
          ]);
        },
      );
      this.assertRowLimit(rows.length);
      return buildWorkbook(
        "Participants",
        ["Event", "Display Name", "Club", "Seed", "Status"],
        rows,
      );
    }

    if (kind === "GroupDraw") {
      const rows = view.groups.flatMap((g) =>
        g.entries.map((e) => [
          escapeExcelCell(g.stageName),
          escapeExcelCell(g.name),
          escapeExcelCell(g.code),
          e.position,
          escapeExcelCell(e.displayName),
          e.seedPosition ?? "",
        ]),
      );
      this.assertRowLimit(rows.length);
      return buildWorkbook(
        "GroupDraw",
        ["Stage", "Group", "Code", "Position", "Entry", "Seed Position"],
        rows,
      );
    }

    if (kind === "Schedule") {
      const rows = view.schedule.map((m) => [
        escapeExcelCell(m.eventName),
        m.roundNumber,
        escapeExcelCell(m.entryAName ?? ""),
        escapeExcelCell(m.entryBName ?? ""),
        escapeExcelCell(m.status),
        escapeExcelCell(m.scheduledAt ?? ""),
        escapeExcelCell(m.courtCode ?? ""),
      ]);
      this.assertRowLimit(rows.length);
      return buildWorkbook(
        "Schedule",
        [
          "Event",
          "Round",
          "Entry A",
          "Entry B",
          "Status",
          "Scheduled At",
          "Court",
        ],
        rows,
      );
    }

    if (kind === "Results") {
      const rows = view.results.map((m) => [
        escapeExcelCell(m.eventName),
        escapeExcelCell(m.entryAName ?? ""),
        escapeExcelCell(m.entryBName ?? ""),
        escapeExcelCell(m.winnerName ?? ""),
        escapeExcelCell(m.resolution ?? ""),
        escapeExcelCell(
          m.sets.map((s) => `${s.scoreA}-${s.scoreB}`).join(", "),
        ),
        escapeExcelCell(m.completedAt ?? ""),
      ]);
      this.assertRowLimit(rows.length);
      return buildWorkbook(
        "Results",
        [
          "Event",
          "Entry A",
          "Entry B",
          "Winner",
          "Resolution",
          "Sets",
          "Completed At",
        ],
        rows,
      );
    }

    const rows = view.standings.flatMap((g) =>
      g.rows.map((r) => [
        escapeExcelCell(g.stageName),
        escapeExcelCell(g.groupName),
        r.rank,
        escapeExcelCell(r.displayName),
        r.played,
        r.wins,
        r.losses,
        r.setDiff,
        r.pointDiff,
      ]),
    );
    this.assertRowLimit(rows.length);
    return buildWorkbook(
      "Standings",
      [
        "Stage",
        "Group",
        "Rank",
        "Entry",
        "Played",
        "Wins",
        "Losses",
        "Set Diff",
        "Point Diff",
      ],
      rows,
    );
  }

  private assertRowLimit(count: number) {
    if (count > EXPORT_MAX_ROWS) {
      throw new ValidationError(
        `Export has ${count} rows; maximum is ${EXPORT_MAX_ROWS}`,
      );
    }
  }
}
