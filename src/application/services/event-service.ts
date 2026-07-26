import {
  DomainStateError,
  NotFoundError,
  ValidationError,
} from "@/application/errors";
import type {
  ActorContext,
  TournamentEvent,
  UpdateTournamentEventInput,
} from "@/core/domain";
import {
  assertEventMutable,
  assertEventTransition,
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
import { DrizzleEntryRepository } from "@/db/repositories/entry-repository";
import { tournamentEvents } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { createId, nowIso } from "@/lib/id";
import {
  createEventSchema,
  parseOrThrow,
  updateEventSchema,
} from "@/lib/validation/schemas";
import { eq } from "drizzle-orm";
import { TournamentAccessService } from "./tournament-access-service";

export class EventService {
  private readonly events: DrizzleTournamentEventRepository;
  private readonly tournaments: DrizzleTournamentRepository;
  private readonly rules: DrizzleMatchRuleRepository;
  private readonly stages: DrizzleStageRepository;
  private readonly entries: DrizzleEntryRepository;
  private readonly access: TournamentAccessService;

  constructor(private readonly db: AppDatabase) {
    this.events = new DrizzleTournamentEventRepository(db);
    this.tournaments = new DrizzleTournamentRepository(db);
    this.rules = new DrizzleMatchRuleRepository(db);
    this.stages = new DrizzleStageRepository(db);
    this.entries = new DrizzleEntryRepository(db);
    this.access = new TournamentAccessService(db);
  }

  listByTournament(tournamentId: string) {
    return this.events.listByTournamentId(tournamentId);
  }

  async getById(id: string) {
    const event = await this.events.findById(id);
    if (!event) {
      throw new NotFoundError(`Event ${id} not found`);
    }
    return event;
  }

  async create(actor: ActorContext, raw: unknown): Promise<TournamentEvent> {
    const input = parseOrThrow(createEventSchema, raw);
    await this.access.assert(actor, input.tournamentId, "setup");

    const tournament = await this.tournaments.findById(input.tournamentId);
    if (!tournament) {
      throw new NotFoundError(`Tournament ${input.tournamentId} not found`);
    }
    assertTournamentNotArchived(tournament.status);

    if (input.defaultMatchRuleId) {
      throw new ValidationError(
        "Assign defaultMatchRuleId after creating a match rule for this event",
        "EVENT_DEFAULT_RULE_PREMATURE",
      );
    }

    return this.db.transaction(async (tx) => {
      const now = nowIso();
      const row = {
        id: createId(),
        tournamentId: input.tournamentId,
        name: input.name,
        type: input.type,
        genderCategory: input.genderCategory,
        status: "SETUP" as const,
        defaultMatchRuleId: null as string | null,
        thirdPlaceMatchEnabled: input.thirdPlaceMatchEnabled ?? false,
        createdAt: now,
        updatedAt: now,
      };
      await tx.insert(tournamentEvents).values(row)
      const created: TournamentEvent = { ...row };
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "event.create",
        entityType: "tournament_event",
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
  ): Promise<TournamentEvent> {
    await this.access.assertForEvent(actor, id, "setup");
    const input = parseOrThrow(
      updateEventSchema,
      raw,
    ) as UpdateTournamentEventInput;
    const existing = await this.getById(id);
    assertEventMutable(existing.status);

    const tournament = await this.tournaments.findById(existing.tournamentId);
    if (!tournament) {
      throw new NotFoundError(`Tournament ${existing.tournamentId} not found`);
    }
    assertTournamentNotArchived(tournament.status);

    if (input.defaultMatchRuleId) {
      const rule = await this.rules.findById(input.defaultMatchRuleId);
      if (!rule || rule.eventId !== id) {
        throw new ValidationError(
          "defaultMatchRuleId must reference a rule belonging to this event",
          "EVENT_DEFAULT_RULE_INVALID",
        );
      }
    }

    return this.db.transaction(async (tx) => {
      const updatedAt = nowIso();
      const next = {
        name: input.name ?? existing.name,
        type: input.type ?? existing.type,
        genderCategory: input.genderCategory ?? existing.genderCategory,
        defaultMatchRuleId:
          input.defaultMatchRuleId !== undefined
            ? input.defaultMatchRuleId
            : existing.defaultMatchRuleId,
        thirdPlaceMatchEnabled:
          input.thirdPlaceMatchEnabled ?? existing.thirdPlaceMatchEnabled,
        updatedAt,
      };
      await tx.update(tournamentEvents)
        .set(next)
        .where(eq(tournamentEvents.id, id))
        
      const updated: TournamentEvent = { ...existing, ...next };
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "event.update",
        entityType: "tournament_event",
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });
  }

  async validateReady(eventId: string) {
    const event = await this.getById(eventId);
    const stages = await this.stages.listByEventId(eventId);
    const rules = await this.rules.listByEventId(eventId);
    const rulesById = new Map(
      rules.map((r) => [r.id, toEngineMatchRule(r)] as const),
    );
    const defaultRule = event.defaultMatchRuleId
      ? (rulesById.get(event.defaultMatchRuleId) ?? null)
      : null;

    const pipelineViews: PipelineStageView[] = [];
    for (const stage of stages) {
      const stageRule = await this.stages.getStageRule(stage.id);
      pipelineViews.push({
        ...stage,
        matchRuleId: stageRule?.matchRuleId ?? null,
      });
    }

    const pipeline = validateStagePipeline(
      pipelineViews,
      defaultRule,
      rulesById,
    );
    const activeEntries = await this.entries.countActiveByEventId(eventId);
    const errors = [...pipeline.errors];
    if (!event.defaultMatchRuleId && pipelineViews.every((s) => !s.matchRuleId)) {
      errors.push("Event needs a default match rule or stage rules");
    }
    if (activeEntries < 2) {
      errors.push("Event needs at least 2 active entries to leave SETUP");
    }

    return {
      ok: errors.length === 0,
      errors,
      activeEntries,
      stageCount: stages.length,
    };
  }

  async transitionStatus(
    actor: ActorContext,
    id: string,
    toStatus: TournamentEvent["status"],
  ): Promise<TournamentEvent> {
    await this.access.assertForEvent(actor, id, "setup");
    const existing = await this.getById(id);
    assertEventTransition(existing.status, toStatus);

    if (existing.status === "SETUP" && toStatus === "DRAW_READY") {
      const validation = await this.validateReady(id);
      if (!validation.ok) {
        throw new DomainStateError(
          `Cannot move to DRAW_READY: ${validation.errors.join("; ")}`,
          "EVENT_NOT_READY",
        );
      }
    }

    // Later transitions (draw confirm, in progress) are owned by TASK 006+.
    if (
      (existing.status === "DRAW_READY" && toStatus === "DRAW_CONFIRMED") ||
      (existing.status === "DRAW_CONFIRMED" && toStatus === "IN_PROGRESS") ||
      (existing.status === "IN_PROGRESS" && toStatus === "COMPLETED")
    ) {
      throw new DomainStateError(
        `Transition ${existing.status} → ${toStatus} requires draw/match flow (later tasks)`,
        "TRANSITION_NOT_AVAILABLE",
      );
    }

    return this.db.transaction(async (tx) => {
      const updatedAt = nowIso();
      await tx.update(tournamentEvents)
        .set({ status: toStatus, updatedAt })
        .where(eq(tournamentEvents.id, id))
        
      const updated: TournamentEvent = {
        ...existing,
        status: toStatus,
        updatedAt,
      };
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: `event.${toStatus.toLowerCase()}`,
        entityType: "tournament_event",
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });
  }
}
