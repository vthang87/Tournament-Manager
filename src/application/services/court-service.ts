import { ConflictError, NotFoundError } from "@/application/errors";
import type { ActorContext, Court, UpdateCourtInput } from "@/core/domain";
import {
  assertTournamentNotArchived,
} from "@/core/domain/state-machines";
import type { AppDatabase } from "@/db/client";
import { DrizzleCourtRepository } from "@/db/repositories/court-repository";
import { DrizzleTournamentRepository } from "@/db/repositories/tournament-repository";
import { courts } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { assertCanPerform } from "@/lib/auth/policies";
import { createId, nowIso } from "@/lib/id";
import {
  createCourtSchema,
  parseOrThrow,
  updateCourtSchema,
} from "@/lib/validation/schemas";
import { eq } from "drizzle-orm";

export class CourtService {
  private readonly courts: DrizzleCourtRepository;
  private readonly tournaments: DrizzleTournamentRepository;

  constructor(private readonly db: AppDatabase) {
    this.courts = new DrizzleCourtRepository(db);
    this.tournaments = new DrizzleTournamentRepository(db);
  }

  listByTournament(tournamentId: string) {
    return this.courts.listByTournamentId(tournamentId);
  }

  async getById(id: string) {
    const court = await this.courts.findById(id);
    if (!court) {
      throw new NotFoundError(`Court ${id} not found`);
    }
    return court;
  }

  async create(actor: ActorContext, raw: unknown): Promise<Court> {
    assertCanPerform(actor.role, "setup");
    const input = parseOrThrow(createCourtSchema, raw);

    const tournament = await this.tournaments.findById(input.tournamentId);
    if (!tournament) {
      throw new NotFoundError(`Tournament ${input.tournamentId} not found`);
    }
    assertTournamentNotArchived(tournament.status);

    const clash = await this.courts.findByTournamentAndCode(
      input.tournamentId,
      input.code,
    );
    if (clash) {
      throw new ConflictError(
        `Court code "${input.code}" already exists in this tournament`,
      );
    }

    return this.db.transaction((tx) => {
      const now = nowIso();
      const row = {
        id: createId(),
        tournamentId: input.tournamentId,
        name: input.name,
        code: input.code,
        active: input.active ?? true,
        createdAt: now,
        updatedAt: now,
      };
      tx.insert(courts).values(row).run();
      const created: Court = { ...row };
      writeAuditLog(tx, {
        userId: actor.userId,
        action: "court.create",
        entityType: "court",
        entityId: created.id,
        after: created,
      });
      return created;
    });
  }

  async update(actor: ActorContext, id: string, raw: unknown): Promise<Court> {
    assertCanPerform(actor.role, "setup");
    const input = parseOrThrow(updateCourtSchema, raw) as UpdateCourtInput;
    const existing = await this.getById(id);

    const tournament = await this.tournaments.findById(existing.tournamentId);
    if (!tournament) {
      throw new NotFoundError(`Tournament ${existing.tournamentId} not found`);
    }
    assertTournamentNotArchived(tournament.status);

    if (input.code && input.code !== existing.code) {
      const clash = await this.courts.findByTournamentAndCode(
        existing.tournamentId,
        input.code,
      );
      if (clash) {
        throw new ConflictError(
          `Court code "${input.code}" already exists in this tournament`,
        );
      }
    }

    return this.db.transaction((tx) => {
      const updatedAt = nowIso();
      const next = {
        name: input.name ?? existing.name,
        code: input.code ?? existing.code,
        active: input.active ?? existing.active,
        updatedAt,
      };
      tx.update(courts).set(next).where(eq(courts.id, id)).run();
      const updated: Court = { ...existing, ...next };
      writeAuditLog(tx, {
        userId: actor.userId,
        action: "court.update",
        entityType: "court",
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });
  }

  async delete(actor: ActorContext, id: string): Promise<void> {
    assertCanPerform(actor.role, "setup");
    const existing = await this.getById(id);
    const tournament = await this.tournaments.findById(existing.tournamentId);
    if (tournament) {
      assertTournamentNotArchived(tournament.status);
    }

    this.db.transaction((tx) => {
      tx.delete(courts).where(eq(courts.id, id)).run();
      writeAuditLog(tx, {
        userId: actor.userId,
        action: "court.delete",
        entityType: "court",
        entityId: id,
        before: existing,
      });
    });
  }
}
