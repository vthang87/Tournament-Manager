import {
  ConflictError,
  DomainStateError,
  NotFoundError,
  ValidationError,
} from "@/application/errors";
import type { ActorContext, EntryWithMembers } from "@/core/domain";
import {
  assertEventMutable,
  assertTournamentNotArchived,
} from "@/core/domain/state-machines";
import type { AppDatabase } from "@/db/client";
import { DrizzleClubRepository } from "@/db/repositories/club-repository";
import { DrizzleEntryRepository } from "@/db/repositories/entry-repository";
import { DrizzlePlayerRepository } from "@/db/repositories/player-repository";
import { DrizzleTournamentEventRepository } from "@/db/repositories/tournament-event-repository";
import { DrizzleTournamentRepository } from "@/db/repositories/tournament-repository";
import {
  clubs,
  entries,
  entryMembers,
  players,
  playerSports,
} from "@/db/schema";
import {
  parseEntriesWorkbook,
  type EventImportKind,
} from "@/features/import-export/excel-workbook";
import type {
  DoublesImportRow,
  ImportPreviewResult,
  SinglesImportRow,
} from "@/features/import-export/parser";
import { writeAuditLog } from "@/lib/audit";
import { createId, nowIso } from "@/lib/id";
import { TournamentAccessService } from "./tournament-access-service";

export type ExcelImportConfirmResult = {
  createdEntryIds: string[];
  createdPlayerIds: string[];
  createdClubIds: string[];
};

type PlannedMember = { playerName: string; position: number };

type PlannedEntry = {
  displayName: string;
  seed: number | null;
  ranking: number | null;
  clubName: string | null;
  members: PlannedMember[];
};

export class ExcelImportService {
  private readonly events: DrizzleTournamentEventRepository;
  private readonly tournaments: DrizzleTournamentRepository;
  private readonly clubs: DrizzleClubRepository;
  private readonly players: DrizzlePlayerRepository;
  private readonly entries: DrizzleEntryRepository;
  private readonly access: TournamentAccessService;

  constructor(private readonly db: AppDatabase) {
    this.events = new DrizzleTournamentEventRepository(db);
    this.tournaments = new DrizzleTournamentRepository(db);
    this.clubs = new DrizzleClubRepository(db);
    this.players = new DrizzlePlayerRepository(db);
    this.entries = new DrizzleEntryRepository(db);
    this.access = new TournamentAccessService(db);
  }

  async previewWorkbook(
    actor: ActorContext,
    eventId: string,
    buffer: ArrayBuffer | Buffer,
  ): Promise<{
    eventType: EventImportKind;
    preview: ImportPreviewResult<SinglesImportRow | DoublesImportRow>;
  }> {
    await this.access.assertForEvent(actor, eventId, "import");
    const { event } = await this.requireImportableEvent(eventId);
    if (event.type !== "SINGLES" && event.type !== "DOUBLES") {
      throw new ValidationError(
        "Only SINGLES and DOUBLES events support Excel import",
      );
    }
    try {
      const preview = await parseEntriesWorkbook(buffer, event.type);
      return { eventType: event.type, preview };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid workbook";
      throw new ValidationError(message);
    }
  }

  async confirmRows(
    actor: ActorContext,
    eventId: string,
    rows: Array<SinglesImportRow | DoublesImportRow>,
  ): Promise<ExcelImportConfirmResult> {
    await this.access.assertForEvent(actor, eventId, "import");
    const { event, tournament } = await this.requireImportableEvent(eventId);
    if (event.type !== "SINGLES" && event.type !== "DOUBLES") {
      throw new ValidationError(
        "Only SINGLES and DOUBLES events support Excel import",
      );
    }
    if (rows.length === 0) {
      throw new ValidationError("No valid rows to import");
    }

    const planned: PlannedEntry[] = rows.map((row) => {
      if (event.type === "SINGLES") {
        const singles = row as SinglesImportRow;
        return {
          displayName: singles.displayName || singles.playerName,
          seed: singles.seed ?? null,
          ranking: singles.ranking ?? null,
          clubName: singles.clubName ?? null,
          members: [{ playerName: singles.playerName, position: 1 }],
        };
      }
      const doubles = row as DoublesImportRow;
      return {
        displayName:
          doubles.displayName ||
          `${doubles.player1Name} / ${doubles.player2Name}`,
        seed: doubles.seed ?? null,
        ranking: doubles.ranking ?? null,
        clubName: doubles.clubName ?? null,
        members: [
          { playerName: doubles.player1Name, position: 1 },
          { playerName: doubles.player2Name, position: 2 },
        ],
      };
    });

    const seedSeen = new Set<number>();
    for (const entry of planned) {
      if (entry.seed != null) {
        if (seedSeen.has(entry.seed)) {
          throw new ValidationError(`Duplicate seed ${entry.seed} in import`);
        }
        seedSeen.add(entry.seed);
        const clash = await this.entries.findActiveBySeed(eventId, entry.seed);
        if (clash) {
          throw new ConflictError(
            `Seed ${entry.seed} is already assigned to an active entry`,
          );
        }
      }
    }

    const existingPlayers = await this.players.list(tournament.ownerUserId);
    const playerByName = new Map(
      existingPlayers.flatMap((p) => [
        [p.name.toLowerCase(), p] as const,
        [p.displayName.toLowerCase(), p] as const,
      ]),
    );

    const playerNamesInBatch = new Set<string>();
    for (const entry of planned) {
      for (const member of entry.members) {
        const key = member.playerName.toLowerCase();
        if (playerNamesInBatch.has(key)) {
          throw new ConflictError(
            `Player "${member.playerName}" appears in more than one import row`,
          );
        }
        playerNamesInBatch.add(key);
        const existing = playerByName.get(key);
        if (existing) {
          const membership = await this.entries.findActivePlayerMembership(
            eventId,
            existing.id,
          );
          if (membership) {
            throw new ConflictError(
              `Player "${member.playerName}" is already in an active entry`,
            );
          }
        }
      }
    }

    const existingClubs = await this.clubs.list(tournament.ownerUserId);
    const clubByName = new Map(
      existingClubs.map((c) => [c.name.toLowerCase(), c] as const),
    );

    const createdEntryIds: string[] = [];
    const createdPlayerIds: string[] = [];
    const createdClubIds: string[] = [];

    await this.db.transaction(async (tx) => {
      const now = nowIso();
      const clubIdByName = new Map(
        [...clubByName.entries()].map(([k, v]) => [k, v.id]),
      );
      const playerIdByName = new Map(
        [...playerByName.entries()].map(([k, v]) => [k, v.id]),
      );

      const resolveClub = async (
        clubName: string | null,
      ): Promise<string | null> => {
        if (!clubName) {
          return null;
        }
        const key = clubName.toLowerCase();
        const existingId = clubIdByName.get(key);
        if (existingId) {
          return existingId;
        }
        const clubId = createId();
        await tx.insert(clubs).values({
          id: clubId,
          ownerUserId: tournament.ownerUserId,
          name: clubName,
          shortName: null,
          logoUrl: null,
          createdAt: now,
          updatedAt: now,
        });
        createdClubIds.push(clubId);
        clubIdByName.set(key, clubId);
        await writeAuditLog(tx, {
          userId: actor.userId,
          action: "club.create",
          entityType: "club",
          entityId: clubId,
          after: { id: clubId, name: clubName },
          metadata: { source: "excel-import" },
        });
        return clubId;
      };

      const resolvePlayer = async (
        playerName: string,
        clubId: string | null,
      ): Promise<string> => {
        const key = playerName.toLowerCase();
        const existingId = playerIdByName.get(key);
        if (existingId) {
          const existingPlayer = playerByName.get(key);
          if (
            existingPlayer &&
            !existingPlayer.sports.some(
              (profile) => profile.sportId === tournament.sportId,
            )
          ) {
            await tx
              .insert(playerSports)
              .values({
                playerId: existingId,
                sportId: tournament.sportId,
                clubId,
                ranking: null,
                createdAt: now,
                updatedAt: now,
              })
              .onConflictDoNothing();
          }
          return existingId;
        }
        const playerId = createId();
        await tx.insert(players).values({
          id: playerId,
          ownerUserId: tournament.ownerUserId,
          name: playerName,
          displayName: playerName,
          gender: "UNSPECIFIED",
          dateOfBirth: null,
          phone: null,
          email: null,
          metadataJson: null,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(playerSports).values({
          playerId,
          sportId: tournament.sportId,
          clubId,
          ranking: null,
          createdAt: now,
          updatedAt: now,
        });
        createdPlayerIds.push(playerId);
        playerIdByName.set(key, playerId);
        await writeAuditLog(tx, {
          userId: actor.userId,
          action: "player.create",
          entityType: "player",
          entityId: playerId,
          after: { id: playerId, name: playerName },
          metadata: { source: "excel-import" },
        });
        return playerId;
      };

      for (const plan of planned) {
        const clubId = await resolveClub(plan.clubName);
        const memberIds = [];
        for (const m of plan.members) {
          memberIds.push({
            playerId: await resolvePlayer(m.playerName, clubId),
            position: m.position,
          });
        }

        const entryId = createId();
        const entryRow = {
          id: entryId,
          eventId,
          displayName: plan.displayName,
          seed: plan.seed,
          ranking: plan.ranking,
          clubId,
          status: "ACTIVE" as const,
          createdAt: now,
          updatedAt: now,
        };
        await tx.insert(entries).values(entryRow);
        for (const member of memberIds) {
          await tx.insert(entryMembers).values({
            entryId,
            playerId: member.playerId,
            position: member.position,
          });
        }

        const created: EntryWithMembers = {
          ...entryRow,
          members: memberIds.map((m) => ({
            entryId,
            playerId: m.playerId,
            position: m.position,
          })),
        };
        createdEntryIds.push(entryId);
        await writeAuditLog(tx, {
          userId: actor.userId,
          action: "entry.create",
          entityType: "entry",
          entityId: entryId,
          after: created,
          metadata: { source: "excel-import" },
        });
      }
    });

    return { createdEntryIds, createdPlayerIds, createdClubIds };
  }

  private async requireImportableEvent(eventId: string) {
    const event = await this.events.findById(eventId);
    if (!event) {
      throw new NotFoundError(`Event ${eventId} not found`);
    }
    if (event.status !== "SETUP" && event.status !== "DRAW_READY") {
      throw new DomainStateError(
        `Entries cannot be imported while event is ${event.status}`,
        "EVENT_ENTRIES_LOCKED",
      );
    }
    const tournament = await this.tournaments.findById(event.tournamentId);
    if (!tournament) {
      throw new NotFoundError(`Tournament ${event.tournamentId} not found`);
    }
    assertTournamentNotArchived(tournament.status);
    assertEventMutable(event.status);
    return { event, tournament };
  }
}
