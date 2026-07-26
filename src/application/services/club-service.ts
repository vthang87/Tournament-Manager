import { NotFoundError } from "@/application/errors";
import type { ActorContext, Club, UpdateClubInput } from "@/core/domain";
import type { AppDatabase } from "@/db/client";
import { DrizzleClubRepository } from "@/db/repositories/club-repository";
import { clubs } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { createId, nowIso } from "@/lib/id";
import {
  createClubSchema,
  parseOrThrow,
  updateClubSchema,
} from "@/lib/validation/schemas";
import { eq } from "drizzle-orm";
import { TournamentAccessService } from "./tournament-access-service";

export class ClubService {
  private readonly clubs: DrizzleClubRepository;
  private readonly access: TournamentAccessService;

  constructor(private readonly db: AppDatabase) {
    this.clubs = new DrizzleClubRepository(db);
    this.access = new TournamentAccessService(db);
  }

  list(actor: ActorContext, query?: string) {
    if (!actor.userId) {
      return [];
    }
    return this.clubs.list(actor.userId, query);
  }

  async listForTournament(actor: ActorContext, tournamentId: string) {
    const access = await this.access.resolve(actor, tournamentId);
    return this.clubs.list(access.tournament.ownerUserId);
  }

  async getById(actor: ActorContext, id: string): Promise<Club> {
    if (!actor.userId) {
      throw new NotFoundError(`Club ${id} not found`);
    }
    const club = await this.clubs.findById(id, actor.userId);
    if (!club) {
      throw new NotFoundError(`Club ${id} not found`);
    }
    return club;
  }

  async create(actor: ActorContext, raw: unknown): Promise<Club> {
    if (!actor.userId) {
      throw new NotFoundError("Authenticated user is required");
    }
    const ownerUserId = actor.userId;
    const input = parseOrThrow(createClubSchema, raw);

    return this.db.transaction(async (tx) => {
      const now = nowIso();
      const row = {
        id: createId(),
        ownerUserId,
        name: input.name,
        shortName: input.shortName ?? null,
        logoUrl: input.logoUrl ?? null,
        createdAt: now,
        updatedAt: now,
      };
      await tx.insert(clubs).values(row)
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "club.create",
        entityType: "club",
        entityId: row.id,
        after: row,
      });
      return row;
    });
  }

  async update(actor: ActorContext, id: string, raw: unknown): Promise<Club> {
    if (!actor.userId) {
      throw new NotFoundError(`Club ${id} not found`);
    }
    const input = parseOrThrow(updateClubSchema, raw) as UpdateClubInput;
    const existing = await this.getById(actor, id);

    return this.db.transaction(async (tx) => {
      const updatedAt = nowIso();
      const next = {
        name: input.name ?? existing.name,
        shortName:
          input.shortName !== undefined ? input.shortName : existing.shortName,
        logoUrl:
          input.logoUrl !== undefined ? input.logoUrl : existing.logoUrl,
        updatedAt,
      };
      await tx.update(clubs).set(next).where(eq(clubs.id, id))
      const updated = { ...existing, ...next };
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "club.update",
        entityType: "club",
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
      await tx.delete(clubs).where(eq(clubs.id, id))
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "club.delete",
        entityType: "club",
        entityId: id,
        before: existing,
      });
    });
  }
}
