import { NotFoundError } from "@/application/errors";
import type {
  ActorContext,
  Player,
  PlayerGender,
  UpdatePlayerInput,
} from "@/core/domain";
import type { AppDatabase } from "@/db/client";
import { DrizzleClubRepository } from "@/db/repositories/club-repository";
import { DrizzlePlayerRepository } from "@/db/repositories/player-repository";
import {
  entries,
  entryMembers,
  players,
  playerSports,
  sports,
  tournamentEvents,
  tournaments,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { createId, nowIso } from "@/lib/id";
import {
  createPlayerSchema,
  parseOrThrow,
  updatePlayerSchema,
} from "@/lib/validation/schemas";
import { and, eq, inArray } from "drizzle-orm";
import { ConflictError } from "@/application/errors";
import { TournamentAccessService } from "./tournament-access-service";

export class PlayerService {
  private readonly players: DrizzlePlayerRepository;
  private readonly clubs: DrizzleClubRepository;
  private readonly access: TournamentAccessService;

  constructor(private readonly db: AppDatabase) {
    this.players = new DrizzlePlayerRepository(db);
    this.clubs = new DrizzleClubRepository(db);
    this.access = new TournamentAccessService(db);
  }

  list(actor: ActorContext, query?: string, sportId?: string) {
    if (!actor.userId) {
      return [];
    }
    return this.players.list(actor.userId, query, sportId);
  }

  async listForTournament(actor: ActorContext, tournamentId: string) {
    const access = await this.access.resolve(actor, tournamentId);
    return this.players.list(
      access.tournament.ownerUserId,
      undefined,
      access.tournament.sportId,
    );
  }

  async getById(actor: ActorContext, id: string): Promise<Player> {
    if (!actor.userId) {
      throw new NotFoundError(`Player ${id} not found`);
    }
    const player = await this.players.findById(id, actor.userId);
    if (!player) {
      throw new NotFoundError(`Player ${id} not found`);
    }
    return player;
  }

  async create(actor: ActorContext, raw: unknown): Promise<Player> {
    if (!actor.userId) {
      throw new NotFoundError("Authenticated user is required");
    }
    const ownerUserId = actor.userId;
    const input = parseOrThrow(createPlayerSchema, raw);

    await this.validateProfiles(ownerUserId, input.sports);

    return this.db.transaction(async (tx) => {
      const now = nowIso();
      const row = {
        id: createId(),
        ownerUserId,
        name: input.name,
        displayName: input.displayName,
        gender: (input.gender ?? "UNSPECIFIED") as PlayerGender,
        dateOfBirth: input.dateOfBirth ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        metadataJson: null as string | null,
        createdAt: now,
        updatedAt: now,
      };
      await tx.insert(players).values(row);
      await tx.insert(playerSports).values(
        input.sports.map((profile) => ({
          playerId: row.id,
          sportId: profile.sportId,
          clubId: profile.clubId ?? null,
          ranking: profile.ranking ?? null,
          createdAt: now,
          updatedAt: now,
        })),
      );
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "player.create",
        entityType: "player",
        entityId: row.id,
        after: row,
      });
      return { ...row, sports: input.sports.map((profile) => ({
        playerId: row.id,
        sportId: profile.sportId,
        clubId: profile.clubId ?? null,
        ranking: profile.ranking ?? null,
        createdAt: now,
        updatedAt: now,
      })) };
    });
  }

  async update(
    actor: ActorContext,
    id: string,
    raw: unknown,
  ): Promise<Player> {
    if (!actor.userId) {
      throw new NotFoundError(`Player ${id} not found`);
    }
    const input = parseOrThrow(updatePlayerSchema, raw) as UpdatePlayerInput;
    const existing = await this.getById(actor, id);

    if (input.sports) {
      await this.validateProfiles(actor.userId, input.sports);
      const removedSportIds = existing.sports
        .filter(
          (profile) =>
            !input.sports!.some((next) => next.sportId === profile.sportId),
        )
        .map((profile) => profile.sportId);
      if (removedSportIds.length > 0) {
        const [used] = await this.db
          .select({ sportId: tournaments.sportId })
          .from(entryMembers)
          .innerJoin(entries, eq(entries.id, entryMembers.entryId))
          .innerJoin(
            tournamentEvents,
            eq(tournamentEvents.id, entries.eventId),
          )
          .innerJoin(
            tournaments,
            eq(tournaments.id, tournamentEvents.tournamentId),
          )
          .where(
            and(
              eq(entryMembers.playerId, id),
              inArray(tournaments.sportId, removedSportIds),
            ),
          )
          .limit(1);
        if (used) {
          throw new ConflictError(
            "Cannot remove a sport used by an existing tournament entry",
          );
        }
      }
    }

    return this.db.transaction(async (tx) => {
      const updatedAt = nowIso();
      const next = {
        name: input.name ?? existing.name,
        displayName: input.displayName ?? existing.displayName,
        gender: input.gender ?? existing.gender,
        dateOfBirth:
          input.dateOfBirth !== undefined
            ? input.dateOfBirth
            : existing.dateOfBirth,
        phone: input.phone !== undefined ? input.phone : existing.phone,
        email: input.email !== undefined ? input.email : existing.email,
        updatedAt,
      };
      await tx.update(players).set(next).where(eq(players.id, id));
      if (input.sports) {
        await tx.delete(playerSports).where(eq(playerSports.playerId, id));
        await tx.insert(playerSports).values(
          input.sports.map((profile) => ({
            playerId: id,
            sportId: profile.sportId,
            clubId: profile.clubId ?? null,
            ranking: profile.ranking ?? null,
            createdAt: updatedAt,
            updatedAt,
          })),
        );
      }
      const updated = {
        ...existing,
        ...next,
        sports: input.sports
          ? input.sports.map((profile) => ({
              playerId: id,
              sportId: profile.sportId,
              clubId: profile.clubId ?? null,
              ranking: profile.ranking ?? null,
              createdAt: updatedAt,
              updatedAt,
            }))
          : existing.sports,
      };
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "player.update",
        entityType: "player",
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });
  }

  async delete(actor: ActorContext, id: string): Promise<void> {
    const existing = await this.getById(actor, id);
    this.db.transaction(async (tx) => {
      await tx.delete(players).where(eq(players.id, id))
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "player.delete",
        entityType: "player",
        entityId: id,
        before: existing,
      });
    });
  }

  private async validateProfiles(
    ownerUserId: string,
    profiles: Array<{
      sportId: string;
      clubId?: string | null;
      ranking?: number | null;
    }>,
  ): Promise<void> {
    for (const profile of profiles) {
      const [sport] = await this.db
        .select({ id: sports.id })
        .from(sports)
        .where(and(eq(sports.id, profile.sportId), eq(sports.active, true)))
        .limit(1);
      if (!sport) {
        throw new NotFoundError(`Sport ${profile.sportId} not found`);
      }
      if (profile.clubId) {
        const club = await this.clubs.findById(profile.clubId, ownerUserId);
        if (!club) {
          throw new NotFoundError(`Club ${profile.clubId} not found`);
        }
      }
    }
  }
}
