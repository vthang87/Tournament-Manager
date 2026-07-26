import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/application/errors";
import type { ActorContext, Court, UpdateCourtInput } from "@/core/domain";
import {
  assertTournamentNotArchived,
} from "@/core/domain/state-machines";
import type { AppDatabase } from "@/db/client";
import { DrizzleCourtRepository } from "@/db/repositories/court-repository";
import { DrizzleTournamentRepository } from "@/db/repositories/tournament-repository";
import { courts } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createId, nowIso } from "@/lib/id";
import {
  createCourtSchema,
  parseOrThrow,
  updateCourtSchema,
} from "@/lib/validation/schemas";
import { eq } from "drizzle-orm";
import { TournamentAccessService } from "./tournament-access-service";

const PIN_RE = /^\d{4,6}$/;
export class CourtService {
  private readonly courts: DrizzleCourtRepository;
  private readonly tournaments: DrizzleTournamentRepository;
  private readonly access: TournamentAccessService;

  constructor(private readonly db: AppDatabase) {
    this.courts = new DrizzleCourtRepository(db);
    this.tournaments = new DrizzleTournamentRepository(db);
    this.access = new TournamentAccessService(db);
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

  async findByTournamentAndCode(tournamentId: string, code: string) {
    return this.courts.findByTournamentAndCode(tournamentId, code);
  }

  async create(actor: ActorContext, raw: unknown): Promise<Court> {
    const input = parseOrThrow(createCourtSchema, raw);
    await this.access.assert(actor, input.tournamentId, "setup");

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

    return this.db.transaction(async (tx) => {
      const now = nowIso();
      const row = {
        id: createId(),
        tournamentId: input.tournamentId,
        name: input.name,
        code: input.code,
        active: input.active ?? true,
        accessPinHash: null as string | null,
        createdAt: now,
        updatedAt: now,
      };
      await tx.insert(courts).values(row)
      const created: Court = {
        id: row.id,
        tournamentId: row.tournamentId,
        name: row.name,
        code: row.code,
        active: row.active,
        hasAccessPin: false,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
      await writeAuditLog(tx, {
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
    await this.access.assertForCourt(actor, id, "setup");
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

    return this.db.transaction(async (tx) => {
      const updatedAt = nowIso();
      const next = {
        name: input.name ?? existing.name,
        code: input.code ?? existing.code,
        active: input.active ?? existing.active,
        updatedAt,
      };
      await tx.update(courts).set(next).where(eq(courts.id, id))
      const updated: Court = { ...existing, ...next };
      await writeAuditLog(tx, {
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

  async setAccessPin(
    actor: ActorContext,
    courtId: string,
    pin: string,
  ): Promise<Court> {
    await this.access.assertForCourt(actor, courtId, "setup");
    if (!PIN_RE.test(pin)) {
      throw new ValidationError(
        "Court PIN must be 4–6 digits",
        "INVALID_COURT_PIN",
      );
    }
    const existing = await this.getById(courtId);
    const tournament = await this.tournaments.findById(existing.tournamentId);
    if (!tournament) {
      throw new NotFoundError(`Tournament ${existing.tournamentId} not found`);
    }
    assertTournamentNotArchived(tournament.status);

    const accessPinHash = await hashPassword(pin);
    const updated = await this.courts.setAccessPinHash(courtId, accessPinHash);
    if (!updated) {
      throw new NotFoundError(`Court ${courtId} not found`);
    }

    await writeAuditLog(this.db, {
      userId: actor.userId,
      action: "court.set_access_pin",
      entityType: "court",
      entityId: courtId,
      before: { hasAccessPin: existing.hasAccessPin },
      after: { hasAccessPin: true },
    });
    return updated;
  }

  async clearAccessPin(actor: ActorContext, courtId: string): Promise<Court> {
    await this.access.assertForCourt(actor, courtId, "setup");
    const existing = await this.getById(courtId);
    const tournament = await this.tournaments.findById(existing.tournamentId);
    if (tournament) {
      assertTournamentNotArchived(tournament.status);
    }

    const updated = await this.courts.setAccessPinHash(courtId, null);
    if (!updated) {
      throw new NotFoundError(`Court ${courtId} not found`);
    }
    await writeAuditLog(this.db, {
      userId: actor.userId,
      action: "court.clear_access_pin",
      entityType: "court",
      entityId: courtId,
      before: { hasAccessPin: existing.hasAccessPin },
      after: { hasAccessPin: false },
    });
    return updated;
  }

  async verifyAccessPin(courtId: string, pin: string): Promise<boolean> {
    const row = await this.courts.findByIdWithPinHash(courtId);
    if (!row?.accessPinHash || !row.active) {
      return false;
    }
    if (!PIN_RE.test(pin)) {
      return false;
    }
    return verifyPassword(row.accessPinHash, pin);
  }

  async delete(actor: ActorContext, id: string): Promise<void> {
    await this.access.assertForCourt(actor, id, "setup");
    const existing = await this.getById(id);
    const tournament = await this.tournaments.findById(existing.tournamentId);
    if (tournament) {
      assertTournamentNotArchived(tournament.status);
    }

    this.db.transaction(async (tx) => {
      await tx.delete(courts).where(eq(courts.id, id))
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "court.delete",
        entityType: "court",
        entityId: id,
        before: existing,
      });
    });
  }
}
