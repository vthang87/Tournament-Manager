import {
  ConflictError,
  NotFoundError,
} from "@/application/errors";
import type {
  ActorContext,
  Tournament,
  TournamentStatus,
  UpdateTournamentInput,
} from "@/core/domain";
import {
  assertTournamentNotArchived,
  assertTournamentTransition,
} from "@/core/domain/state-machines";
import type { AppDatabase } from "@/db/client";
import { DrizzleTournamentRepository } from "@/db/repositories/tournament-repository";
import { sports, tournamentEvents, tournaments } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { createId, nowIso } from "@/lib/id";
import {
  createTournamentSchema,
  parseOrThrow,
  updateTournamentSchema,
} from "@/lib/validation/schemas";
import { eq } from "drizzle-orm";
import { TournamentAccessService } from "./tournament-access-service";

export class TournamentService {
  private readonly tournaments: DrizzleTournamentRepository;
  private readonly access: TournamentAccessService;

  constructor(private readonly db: AppDatabase) {
    this.tournaments = new DrizzleTournamentRepository(db);
    this.access = new TournamentAccessService(db);
  }

  list(actor: ActorContext) {
    if (!actor.userId) {
      return [];
    }
    return this.tournaments.listAccessibleByUser(actor.userId);
  }

  async getById(id: string) {
    const tournament = await this.tournaments.findById(id);
    if (!tournament) {
      throw new NotFoundError(`Tournament ${id} not found`);
    }
    return tournament;
  }

  async create(actor: ActorContext, raw: unknown): Promise<Tournament> {
    if (!actor.userId) {
      throw new NotFoundError("Authenticated user is required");
    }
    const ownerUserId = actor.userId;
    const input = parseOrThrow(createTournamentSchema, raw);
    const [sport] = await this.db
      .select()
      .from(sports)
      .where(eq(sports.id, input.sportId))
      .limit(1);
    if (!sport?.active) {
      throw new NotFoundError(`Sport ${input.sportId} not found`);
    }

    const existing = await this.tournaments.findBySlug(input.slug);
    if (existing) {
      throw new ConflictError(`Slug "${input.slug}" is already in use`);
    }

    return this.db.transaction(async (tx) => {
      const now = nowIso();
      const row = {
        id: createId(),
        ownerUserId,
        sportId: input.sportId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        location: input.location ?? null,
        timezone: input.timezone,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        status: "DRAFT" as TournamentStatus,
        createdAt: now,
        updatedAt: now,
      };
      await tx.insert(tournaments).values(row)
      const created: Tournament = {
        ...row,
        status: row.status,
      };
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "tournament.create",
        entityType: "tournament",
        entityId: created.id,
        after: created,
      });
      return created;
    });
  }

  async update(
    actor: ActorContext,
    id: string,
    raw: unknown,
  ): Promise<Tournament> {
    const input = parseOrThrow(
      updateTournamentSchema,
      raw,
    ) as UpdateTournamentInput;
    const { tournament: existing } = await this.access.assert(
      actor,
      id,
      "setup",
    );
    assertTournamentNotArchived(existing.status);

    if (input.slug && input.slug !== existing.slug) {
      const clash = await this.tournaments.findBySlug(input.slug);
      if (clash) {
        throw new ConflictError(`Slug "${input.slug}" is already in use`);
      }
    }

    if (input.sportId && input.sportId !== existing.sportId) {
      const [event] = await this.db
        .select({ id: tournamentEvents.id })
        .from(tournamentEvents)
        .where(eq(tournamentEvents.tournamentId, id))
        .limit(1);
      if (existing.status !== "DRAFT" || event) {
        throw new ConflictError(
          "Tournament sport can only change while draft and before events exist",
        );
      }
      const [sport] = await this.db
        .select()
        .from(sports)
        .where(eq(sports.id, input.sportId))
        .limit(1);
      if (!sport?.active) {
        throw new NotFoundError(`Sport ${input.sportId} not found`);
      }
    }

    return this.db.transaction(async (tx) => {
      const now = nowIso();
      const next = {
        sportId: input.sportId ?? existing.sportId,
        name: input.name ?? existing.name,
        slug: input.slug ?? existing.slug,
        description:
          input.description !== undefined
            ? input.description
            : existing.description,
        location:
          input.location !== undefined ? input.location : existing.location,
        timezone: input.timezone ?? existing.timezone,
        startDate:
          input.startDate !== undefined ? input.startDate : existing.startDate,
        endDate: input.endDate !== undefined ? input.endDate : existing.endDate,
        updatedAt: now,
      };
      await tx.update(tournaments).set(next).where(eq(tournaments.id, id))
      const updated: Tournament = { ...existing, ...next };
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "tournament.update",
        entityType: "tournament",
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });
  }

  async transitionStatus(
    actor: ActorContext,
    id: string,
    toStatus: TournamentStatus,
  ): Promise<Tournament> {
    const action = toStatus === "ARCHIVED" ? "archive" : "setup";
    const { tournament: existing } = await this.access.assert(actor, id, action);
    assertTournamentTransition(existing.status, toStatus);

    return this.db.transaction(async (tx) => {
      const updatedAt = nowIso();
      await tx.update(tournaments)
        .set({ status: toStatus, updatedAt })
        .where(eq(tournaments.id, id))
        
      const updated: Tournament = { ...existing, status: toStatus, updatedAt };
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: `tournament.${toStatus.toLowerCase()}`,
        entityType: "tournament",
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });
  }

  async archive(actor: ActorContext, id: string) {
    return this.transitionStatus(actor, id, "ARCHIVED");
  }
}
