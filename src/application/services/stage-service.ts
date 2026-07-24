import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/application/errors";
import type {
  ActorContext,
  Stage,
  StageRule,
  UpdateStageInput,
} from "@/core/domain";
import {
  assertEventMutable,
  assertStageTransition,
  assertTournamentNotArchived,
} from "@/core/domain/state-machines";
import {
  type PipelineStageView,
  validateStagePipeline,
} from "@/core/domain/pipeline";
import type { AppDatabase } from "@/db/client";
import { DrizzleTournamentEventRepository } from "@/db/repositories/tournament-event-repository";
import { DrizzleTournamentRepository } from "@/db/repositories/tournament-repository";
import {
  DrizzleMatchRuleRepository,
  toEngineMatchRule,
} from "@/db/repositories/match-rule-repository";
import { DrizzleStageRepository } from "@/db/repositories/stage-repository";
import { stageRules, stages } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { assertCanPerform } from "@/lib/auth/policies";
import { createId, nowIso } from "@/lib/id";
import {
  createStageSchema,
  parseOrThrow,
  reorderStagesSchema,
  updateStageSchema,
} from "@/lib/validation/schemas";
import { eq } from "drizzle-orm";

export class StageService {
  private readonly stages: DrizzleStageRepository;
  private readonly events: DrizzleTournamentEventRepository;
  private readonly tournaments: DrizzleTournamentRepository;
  private readonly rules: DrizzleMatchRuleRepository;

  constructor(private readonly db: AppDatabase) {
    this.stages = new DrizzleStageRepository(db);
    this.events = new DrizzleTournamentEventRepository(db);
    this.tournaments = new DrizzleTournamentRepository(db);
    this.rules = new DrizzleMatchRuleRepository(db);
  }

  listByEvent(eventId: string) {
    return this.stages.listByEventId(eventId);
  }

  async getById(id: string) {
    const stage = await this.stages.findById(id);
    if (!stage) {
      throw new NotFoundError(`Stage ${id} not found`);
    }
    return stage;
  }

  async getStageRule(stageId: string) {
    return this.stages.getStageRule(stageId);
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

  async create(
    actor: ActorContext,
    raw: unknown,
  ): Promise<{ stage: Stage; stageRule: StageRule | null }> {
    assertCanPerform(actor.role, "setup");
    const input = parseOrThrow(createStageSchema, raw);
    await this.assertEventSetup(input.eventId);

    if (input.matchRuleId) {
      const rule = await this.rules.findById(input.matchRuleId);
      if (!rule || rule.eventId !== input.eventId) {
        throw new ValidationError(
          "matchRuleId must belong to the same event",
          "STAGE_RULE_INVALID",
        );
      }
    }

    const clash = await this.stages.findByEventAndOrder(
      input.eventId,
      input.orderIndex,
    );
    if (clash) {
      throw new ConflictError(
        `orderIndex ${input.orderIndex} already used in this event`,
      );
    }

    return this.db.transaction((tx) => {
      const now = nowIso();
      const row = {
        id: createId(),
        eventId: input.eventId,
        type: input.type,
        name: input.name,
        orderIndex: input.orderIndex,
        format: input.format,
        status: "PENDING" as const,
        createdAt: now,
        updatedAt: now,
      };
      tx.insert(stages).values(row).run();
      let stageRule: StageRule | null = null;
      if (input.matchRuleId) {
        tx.insert(stageRules)
          .values({ stageId: row.id, matchRuleId: input.matchRuleId })
          .run();
        stageRule = { stageId: row.id, matchRuleId: input.matchRuleId };
      }
      const stage: Stage = { ...row };
      writeAuditLog(tx, {
        userId: actor.userId,
        action: "stage.create",
        entityType: "stage",
        entityId: stage.id,
        after: { stage, stageRule },
      });
      return { stage, stageRule };
    });
  }

  async update(
    actor: ActorContext,
    id: string,
    raw: unknown,
  ): Promise<{ stage: Stage; stageRule: StageRule | null }> {
    assertCanPerform(actor.role, "setup");
    const input = parseOrThrow(updateStageSchema, raw) as UpdateStageInput;
    const existing = await this.getById(id);
    await this.assertEventSetup(existing.eventId);

    if (input.matchRuleId) {
      const rule = await this.rules.findById(input.matchRuleId);
      if (!rule || rule.eventId !== existing.eventId) {
        throw new ValidationError(
          "matchRuleId must belong to the same event",
          "STAGE_RULE_INVALID",
        );
      }
    }

    return this.db.transaction((tx) => {
      const updatedAt = nowIso();
      const next = {
        type: input.type ?? existing.type,
        name: input.name ?? existing.name,
        format: input.format ?? existing.format,
        updatedAt,
      };
      tx.update(stages).set(next).where(eq(stages.id, id)).run();

      let stageRule: StageRule | null = null;
      if (input.matchRuleId !== undefined) {
        tx.delete(stageRules).where(eq(stageRules.stageId, id)).run();
        if (input.matchRuleId) {
          tx.insert(stageRules)
            .values({ stageId: id, matchRuleId: input.matchRuleId })
            .run();
          stageRule = { stageId: id, matchRuleId: input.matchRuleId };
        }
      } else {
        // keep existing — read after outside; for audit load from before
        stageRule = null;
      }

      const stage: Stage = { ...existing, ...next };
      writeAuditLog(tx, {
        userId: actor.userId,
        action: "stage.update",
        entityType: "stage",
        entityId: id,
        before: existing,
        after: { stage, matchRuleId: input.matchRuleId },
      });
      return { stage, stageRule };
    });
  }

  async reorder(actor: ActorContext, raw: unknown): Promise<Stage[]> {
    assertCanPerform(actor.role, "setup");
    const input = parseOrThrow(reorderStagesSchema, raw);
    await this.assertEventSetup(input.eventId);

    const existing = await this.stages.listByEventId(input.eventId);
    const existingIds = new Set(existing.map((s) => s.id));
    if (
      input.orderedStageIds.length !== existing.length ||
      !input.orderedStageIds.every((id) => existingIds.has(id))
    ) {
      throw new ValidationError(
        "orderedStageIds must contain exactly the existing stages for the event",
        "STAGE_REORDER_MISMATCH",
      );
    }

    return this.db.transaction((tx) => {
      const now = nowIso();
      // Two-phase update to avoid unique (event_id, order_index) collisions.
      for (let i = 0; i < input.orderedStageIds.length; i++) {
        const id = input.orderedStageIds[i]!;
        tx.update(stages)
          .set({ orderIndex: -(i + 1), updatedAt: now })
          .where(eq(stages.id, id))
          .run();
      }
      for (let i = 0; i < input.orderedStageIds.length; i++) {
        const id = input.orderedStageIds[i]!;
        tx.update(stages)
          .set({ orderIndex: i, updatedAt: now })
          .where(eq(stages.id, id))
          .run();
      }
      writeAuditLog(tx, {
        userId: actor.userId,
        action: "stage.reorder",
        entityType: "tournament_event",
        entityId: input.eventId,
        after: { orderedStageIds: input.orderedStageIds },
      });
      return input.orderedStageIds.map((id, orderIndex) => {
        const stage = existing.find((s) => s.id === id)!;
        return { ...stage, orderIndex, updatedAt: now };
      });
    });
  }

  async delete(actor: ActorContext, id: string): Promise<void> {
    assertCanPerform(actor.role, "setup");
    const existing = await this.getById(id);
    await this.assertEventSetup(existing.eventId);

    this.db.transaction((tx) => {
      tx.delete(stageRules).where(eq(stageRules.stageId, id)).run();
      tx.delete(stages).where(eq(stages.id, id)).run();
      writeAuditLog(tx, {
        userId: actor.userId,
        action: "stage.delete",
        entityType: "stage",
        entityId: id,
        before: existing,
      });
    });
  }

  async validatePipeline(eventId: string) {
    const event = await this.events.findById(eventId);
    if (!event) {
      throw new NotFoundError(`Event ${eventId} not found`);
    }
    const stageList = await this.stages.listByEventId(eventId);
    const rules = await this.rules.listByEventId(eventId);
    const rulesById = new Map(
      rules.map((r) => [r.id, toEngineMatchRule(r)] as const),
    );
    const defaultRule = event.defaultMatchRuleId
      ? (rulesById.get(event.defaultMatchRuleId) ?? null)
      : null;

    const views: PipelineStageView[] = [];
    for (const stage of stageList) {
      const sr = await this.stages.getStageRule(stage.id);
      views.push({ ...stage, matchRuleId: sr?.matchRuleId ?? null });
    }
    return validateStagePipeline(views, defaultRule, rulesById);
  }

  async transitionStatus(
    actor: ActorContext,
    id: string,
    toStatus: Stage["status"],
  ) {
    assertCanPerform(actor.role, "setup");
    const existing = await this.getById(id);
    assertStageTransition(existing.status, toStatus);

    return this.db.transaction((tx) => {
      const updatedAt = nowIso();
      tx.update(stages)
        .set({ status: toStatus, updatedAt })
        .where(eq(stages.id, id))
        .run();
      const updated: Stage = { ...existing, status: toStatus, updatedAt };
      writeAuditLog(tx, {
        userId: actor.userId,
        action: `stage.${toStatus.toLowerCase()}`,
        entityType: "stage",
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });
  }
}
