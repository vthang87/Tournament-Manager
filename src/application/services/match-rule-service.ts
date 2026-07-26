import { NotFoundError, ValidationError } from "@/application/errors";
import type {
  ActorContext,
  MatchRuleRecord,
  UpdateMatchRuleInput,
} from "@/core/domain";
import {
  assertEventMutable,
  assertTournamentNotArchived,
} from "@/core/domain/state-machines";
import { matchRuleSnapshotSchema } from "@/core/tournament-engine/match-rules/schemas";
import type { AppDatabase } from "@/db/client";
import { DrizzleTournamentEventRepository } from "@/db/repositories/tournament-event-repository";
import { DrizzleTournamentRepository } from "@/db/repositories/tournament-repository";
import { matchRules, stageRules, tournamentEvents } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { createId, nowIso } from "@/lib/id";
import {
  createMatchRuleSchema,
  parseOrThrow,
  updateMatchRuleSchema,
} from "@/lib/validation/schemas";
import { eq } from "drizzle-orm";
import { TournamentAccessService } from "./tournament-access-service";

function validateScoringShape(input: {
  bestOfSets: number;
  pointsToWin: number;
  winBy: number;
  maxPoints: number;
  deuceEnabled: boolean;
  decidingSetPoints: number | null;
  decidingSetWinBy: number | null;
  decidingSetMaxPoints: number | null;
  changeEndsEnabled: boolean;
  changeEndsAt: number | null;
}) {
  const result = matchRuleSnapshotSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(
      result.error.issues.map((i) => i.message).join("; "),
      "MATCH_RULE_INVALID",
    );
  }
}

export class MatchRuleService {
  private readonly access: TournamentAccessService;
  private readonly events: DrizzleTournamentEventRepository;
  private readonly tournaments: DrizzleTournamentRepository;

  constructor(private readonly db: AppDatabase) {
    this.access = new TournamentAccessService(db);
    this.events = new DrizzleTournamentEventRepository(db);
    this.tournaments = new DrizzleTournamentRepository(db);
  }

  async listByEvent(eventId: string): Promise<MatchRuleRecord[]> {
    const rows = await this.db
      .select()
      .from(matchRules)
      .where(eq(matchRules.eventId, eventId));
    return rows.map((row) => ({ ...row }));
  }

  async getById(id: string): Promise<MatchRuleRecord> {
    const rows = await this.db
      .select()
      .from(matchRules)
      .where(eq(matchRules.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new NotFoundError(`Match rule ${id} not found`);
    }
    return { ...row };
  }

  private async assertEventSetup(eventId: string) {
    const event = await this.events.findById(eventId);
    if (!event) {
      throw new NotFoundError(`Event ${eventId} not found`);
    }
    assertEventMutable(event.status);
    const tournament = await this.tournaments.findById(event.tournamentId);
    if (!tournament) {
      throw new NotFoundError(`Tournament ${event.tournamentId} not found`);
    }
    assertTournamentNotArchived(tournament.status);
    return event;
  }

  async create(actor: ActorContext, raw: unknown): Promise<MatchRuleRecord> {
    const input = parseOrThrow(createMatchRuleSchema, raw);
    await this.access.assertForEvent(actor, input.eventId, "setup");
    await this.assertEventSetup(input.eventId);

    const scoring = {
      bestOfSets: input.bestOfSets,
      pointsToWin: input.pointsToWin,
      winBy: input.winBy,
      maxPoints: input.maxPoints,
      deuceEnabled: input.deuceEnabled ?? true,
      decidingSetPoints: input.decidingSetPoints ?? null,
      decidingSetWinBy: input.decidingSetWinBy ?? null,
      decidingSetMaxPoints: input.decidingSetMaxPoints ?? null,
      changeEndsEnabled: input.changeEndsEnabled ?? true,
      changeEndsAt: input.changeEndsAt ?? 11,
    };
    validateScoringShape(scoring);

    return this.db.transaction(async (tx) => {
      const now = nowIso();
      const row = {
        id: createId(),
        eventId: input.eventId,
        name: input.name,
        ...scoring,
        createdAt: now,
        updatedAt: now,
      };
      await tx.insert(matchRules).values(row)
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "match_rule.create",
        entityType: "match_rule",
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
  ): Promise<MatchRuleRecord> {
    await this.access.assertForRule(actor, id, "setup");
    const input = parseOrThrow(
      updateMatchRuleSchema,
      raw,
    ) as UpdateMatchRuleInput;
    const existing = await this.getById(id);
    await this.assertEventSetup(existing.eventId);

    const scoring = {
      bestOfSets: input.bestOfSets ?? existing.bestOfSets,
      pointsToWin: input.pointsToWin ?? existing.pointsToWin,
      winBy: input.winBy ?? existing.winBy,
      maxPoints: input.maxPoints ?? existing.maxPoints,
      deuceEnabled: input.deuceEnabled ?? existing.deuceEnabled,
      decidingSetPoints:
        input.decidingSetPoints !== undefined
          ? input.decidingSetPoints
          : existing.decidingSetPoints,
      decidingSetWinBy:
        input.decidingSetWinBy !== undefined
          ? input.decidingSetWinBy
          : existing.decidingSetWinBy,
      decidingSetMaxPoints:
        input.decidingSetMaxPoints !== undefined
          ? input.decidingSetMaxPoints
          : existing.decidingSetMaxPoints,
      changeEndsEnabled: input.changeEndsEnabled ?? existing.changeEndsEnabled,
      changeEndsAt:
        input.changeEndsAt !== undefined
          ? input.changeEndsAt
          : existing.changeEndsAt,
    };
    validateScoringShape(scoring);

    return this.db.transaction(async (tx) => {
      const updatedAt = nowIso();
      const next = {
        name: input.name ?? existing.name,
        ...scoring,
        updatedAt,
      };
      await tx.update(matchRules).set(next).where(eq(matchRules.id, id))
      const updated = { ...existing, ...next };
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "match_rule.update",
        entityType: "match_rule",
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });
  }

  async delete(actor: ActorContext, id: string): Promise<void> {
    await this.access.assertForRule(actor, id, "setup");
    const existing = await this.getById(id);
    await this.assertEventSetup(existing.eventId);

    // Clear references that would block delete.
    this.db.transaction(async (tx) => {
      await tx.update(tournamentEvents)
        .set({ defaultMatchRuleId: null, updatedAt: nowIso() })
        .where(eq(tournamentEvents.defaultMatchRuleId, id))
        
      await tx.delete(stageRules).where(eq(stageRules.matchRuleId, id))
      await tx.delete(matchRules).where(eq(matchRules.id, id))
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "match_rule.delete",
        entityType: "match_rule",
        entityId: id,
        before: existing,
      });
    });
  }
}
