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
import { tournaments } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { assertCanPerform } from "@/lib/auth/policies";
import { createId, nowIso } from "@/lib/id";
import {
  createTournamentSchema,
  parseOrThrow,
  updateTournamentSchema,
} from "@/lib/validation/schemas";
import { eq } from "drizzle-orm";

export class TournamentService {
  private readonly tournaments: DrizzleTournamentRepository;

  constructor(private readonly db: AppDatabase) {
    this.tournaments = new DrizzleTournamentRepository(db);
  }

  list() {
    return this.tournaments.list();
  }

  async getById(id: string) {
    const tournament = await this.tournaments.findById(id);
    if (!tournament) {
      throw new NotFoundError(`Tournament ${id} not found`);
    }
    return tournament;
  }

  async create(actor: ActorContext, raw: unknown): Promise<Tournament> {
    assertCanPerform(actor.role, "setup");
    const input = parseOrThrow(createTournamentSchema, raw);

    const existing = await this.tournaments.findBySlug(input.slug);
    if (existing) {
      throw new ConflictError(`Slug "${input.slug}" is already in use`);
    }

    return this.db.transaction((tx) => {
      const now = nowIso();
      const row = {
        id: createId(),
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
      tx.insert(tournaments).values(row).run();
      const created: Tournament = {
        ...row,
        status: row.status,
      };
      writeAuditLog(tx, {
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
    assertCanPerform(actor.role, "setup");
    const input = parseOrThrow(
      updateTournamentSchema,
      raw,
    ) as UpdateTournamentInput;
    const existing = await this.getById(id);
    assertTournamentNotArchived(existing.status);

    if (input.slug && input.slug !== existing.slug) {
      const clash = await this.tournaments.findBySlug(input.slug);
      if (clash) {
        throw new ConflictError(`Slug "${input.slug}" is already in use`);
      }
    }

    return this.db.transaction((tx) => {
      const now = nowIso();
      const next = {
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
      tx.update(tournaments).set(next).where(eq(tournaments.id, id)).run();
      const updated: Tournament = { ...existing, ...next };
      writeAuditLog(tx, {
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
    assertCanPerform(actor.role, action);
    const existing = await this.getById(id);
    assertTournamentTransition(existing.status, toStatus);

    return this.db.transaction((tx) => {
      const updatedAt = nowIso();
      tx.update(tournaments)
        .set({ status: toStatus, updatedAt })
        .where(eq(tournaments.id, id))
        .run();
      const updated: Tournament = { ...existing, status: toStatus, updatedAt };
      writeAuditLog(tx, {
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
