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
import { players } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { assertCanPerform } from "@/lib/auth/policies";
import { createId, nowIso } from "@/lib/id";
import {
  createPlayerSchema,
  parseOrThrow,
  updatePlayerSchema,
} from "@/lib/validation/schemas";
import { eq } from "drizzle-orm";

export class PlayerService {
  private readonly players: DrizzlePlayerRepository;
  private readonly clubs: DrizzleClubRepository;

  constructor(private readonly db: AppDatabase) {
    this.players = new DrizzlePlayerRepository(db);
    this.clubs = new DrizzleClubRepository(db);
  }

  list(query?: string) {
    return this.players.list(query);
  }

  async getById(id: string): Promise<Player> {
    const player = await this.players.findById(id);
    if (!player) {
      throw new NotFoundError(`Player ${id} not found`);
    }
    return player;
  }

  async create(actor: ActorContext, raw: unknown): Promise<Player> {
    assertCanPerform(actor.role, "import");
    const input = parseOrThrow(createPlayerSchema, raw);

    if (input.clubId) {
      const club = await this.clubs.findById(input.clubId);
      if (!club) {
        throw new NotFoundError(`Club ${input.clubId} not found`);
      }
    }

    return this.db.transaction((tx) => {
      const now = nowIso();
      const row = {
        id: createId(),
        name: input.name,
        displayName: input.displayName,
        gender: (input.gender ?? "UNSPECIFIED") as PlayerGender,
        dateOfBirth: input.dateOfBirth ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        clubId: input.clubId ?? null,
        ranking: input.ranking ?? null,
        metadataJson: null as string | null,
        createdAt: now,
        updatedAt: now,
      };
      tx.insert(players).values(row).run();
      writeAuditLog(tx, {
        userId: actor.userId,
        action: "player.create",
        entityType: "player",
        entityId: row.id,
        after: row,
      });
      return row;
    });
  }

  async update(
    actor: ActorContext,
    id: string,
    raw: unknown,
  ): Promise<Player> {
    assertCanPerform(actor.role, "import");
    const input = parseOrThrow(updatePlayerSchema, raw) as UpdatePlayerInput;
    const existing = await this.getById(id);

    if (input.clubId) {
      const club = await this.clubs.findById(input.clubId);
      if (!club) {
        throw new NotFoundError(`Club ${input.clubId} not found`);
      }
    }

    return this.db.transaction((tx) => {
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
        clubId: input.clubId !== undefined ? input.clubId : existing.clubId,
        ranking:
          input.ranking !== undefined ? input.ranking : existing.ranking,
        updatedAt,
      };
      tx.update(players).set(next).where(eq(players.id, id)).run();
      const updated = { ...existing, ...next };
      writeAuditLog(tx, {
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
    assertCanPerform(actor.role, "import");
    const existing = await this.getById(id);
    this.db.transaction((tx) => {
      tx.delete(players).where(eq(players.id, id)).run();
      writeAuditLog(tx, {
        userId: actor.userId,
        action: "player.delete",
        entityType: "player",
        entityId: id,
        before: existing,
      });
    });
  }
}
