import {
  ConflictError,
  DomainStateError,
  NotFoundError,
  ValidationError,
} from "@/application/errors";
import type { ActorContext, MatchRuleRecord, Stage } from "@/core/domain";
import {
  assertEventMutable,
  assertTournamentNotArchived,
} from "@/core/domain/state-machines";
import {
  EVENT_SETUP_TEMPLATES,
  MATCH_RULE_PRESETS,
  getEventSetupTemplate,
  getMatchRulePreset,
  type MatchRuleTemplateFields,
} from "@/core/domain/setup-templates";
import type { AppDatabase } from "@/db/client";
import { DrizzleTournamentEventRepository } from "@/db/repositories/tournament-event-repository";
import { DrizzleTournamentRepository } from "@/db/repositories/tournament-repository";
import {
  matchRules,
  stageRules,
  stages,
  tournamentEvents,
} from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { assertCanPerform } from "@/lib/auth/policies";
import { createId, nowIso } from "@/lib/id";
import { and, eq } from "drizzle-orm";

export class EventSetupService {
  private readonly events: DrizzleTournamentEventRepository;
  private readonly tournaments: DrizzleTournamentRepository;

  constructor(private readonly db: AppDatabase) {
    this.events = new DrizzleTournamentEventRepository(db);
    this.tournaments = new DrizzleTournamentRepository(db);
  }

  listRulePresets() {
    return MATCH_RULE_PRESETS;
  }

  listSetupTemplates() {
    return EVENT_SETUP_TEMPLATES;
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

  /** Create a single rule from preset if name not already present. */
  async applyRulePreset(
    actor: ActorContext,
    eventId: string,
    presetId: string,
  ): Promise<{ rule: MatchRuleRecord; created: boolean }> {
    assertCanPerform(actor.role, "setup");
    await this.assertEventSetup(eventId);
    const preset = getMatchRulePreset(presetId);
    if (!preset) {
      throw new ValidationError(
        `Unknown rule preset: ${presetId}`,
        "UNKNOWN_PRESET",
      );
    }

    const existing = await this.db
      .select()
      .from(matchRules)
      .where(
        and(
          eq(matchRules.eventId, eventId),
          eq(matchRules.name, preset.fields.name),
        ),
      )
      .limit(1);

    if (existing[0]) {
      return { rule: existing[0], created: false };
    }

    return this.db.transaction((tx) => {
      const now = nowIso();
      const rule = buildRuleRow(eventId, preset.fields, now);
      tx.insert(matchRules).values(rule).run();
      writeAuditLog(tx, {
        userId: actor.userId,
        action: "match_rule.apply_preset",
        entityType: "match_rule",
        entityId: rule.id,
        after: { presetId, rule },
      });
      return { rule, created: true };
    });
  }

  /**
   * Apply a full event setup template (rules + stages).
   * When replace=true and event is SETUP, existing stages (and their stage_rules)
   * are removed first. Rules are reused by name when possible.
   */
  async applySetupTemplate(
    actor: ActorContext,
    eventId: string,
    templateId: string,
    options?: { replace?: boolean },
  ): Promise<{
    templateId: string;
    rulesCreated: number;
    stagesCreated: number;
    replacedStages: number;
  }> {
    assertCanPerform(actor.role, "setup");
    const event = await this.assertEventSetup(eventId);
    const template = getEventSetupTemplate(templateId);
    if (!template) {
      throw new ValidationError(
        `Unknown setup template: ${templateId}`,
        "UNKNOWN_TEMPLATE",
      );
    }

    const existingStages = await this.db
      .select()
      .from(stages)
      .where(eq(stages.eventId, eventId));
    const existingRules = await this.db
      .select()
      .from(matchRules)
      .where(eq(matchRules.eventId, eventId));

    const replace = options?.replace === true;
    if (existingStages.length > 0 && !replace) {
      throw new ConflictError(
        "Event already has stages. Apply with replace=true to rebuild the pipeline (SETUP only).",
        "STAGES_EXIST",
      );
    }

    if (replace && event.status !== "SETUP") {
      throw new DomainStateError(
        "Can only replace stages while event is SETUP",
        "EVENT_NOT_MUTABLE",
      );
    }

    const rulesByName = new Map(existingRules.map((r) => [r.name, r]));

    return this.db.transaction((tx) => {
      const now = nowIso();
      let replacedStages = 0;

      if (replace && existingStages.length > 0) {
        for (const stage of existingStages) {
          tx.delete(stageRules).where(eq(stageRules.stageId, stage.id)).run();
          tx.delete(stages).where(eq(stages.id, stage.id)).run();
          replacedStages += 1;
        }
      }

      const ruleIdByKey = new Map<string, string>();
      let rulesCreated = 0;

      for (const def of template.rules) {
        const found = rulesByName.get(def.fields.name);
        if (found) {
          ruleIdByKey.set(def.key, found.id);
          continue;
        }
        const created = buildRuleRow(eventId, def.fields, now);
        tx.insert(matchRules).values(created).run();
        rulesByName.set(created.name, created);
        ruleIdByKey.set(def.key, created.id);
        rulesCreated += 1;
      }

      const defaultRuleId = ruleIdByKey.get(template.defaultRuleKey) ?? null;
      tx.update(tournamentEvents)
        .set({
          defaultMatchRuleId: defaultRuleId,
          thirdPlaceMatchEnabled: template.thirdPlaceMatchEnabled ?? false,
          updatedAt: now,
        })
        .where(eq(tournamentEvents.id, eventId))
        .run();

      let stagesCreated = 0;
      const createdStages: Stage[] = [];
      for (const stageDef of template.stages) {
        const matchRuleId = ruleIdByKey.get(stageDef.ruleKey);
        if (!matchRuleId) {
          throw new ValidationError(
            `Template stage missing rule key ${stageDef.ruleKey}`,
            "TEMPLATE_RULE_MISSING",
          );
        }
        const row = {
          id: createId(),
          eventId,
          type: stageDef.type,
          name: stageDef.name,
          orderIndex: stageDef.orderIndex,
          format: stageDef.format,
          status: "PENDING" as const,
          createdAt: now,
          updatedAt: now,
        };
        tx.insert(stages).values(row).run();
        tx.insert(stageRules)
          .values({ stageId: row.id, matchRuleId })
          .run();
        createdStages.push(row);
        stagesCreated += 1;
      }

      writeAuditLog(tx, {
        userId: actor.userId,
        action: "event.apply_setup_template",
        entityType: "tournament_event",
        entityId: eventId,
        after: {
          templateId,
          rulesCreated,
          stagesCreated,
          replacedStages,
          stageIds: createdStages.map((s) => s.id),
        },
      });

      return { templateId, rulesCreated, stagesCreated, replacedStages };
    });
  }
}

function buildRuleRow(
  eventId: string,
  fields: MatchRuleTemplateFields,
  now: string,
): MatchRuleRecord {
  return {
    id: createId(),
    eventId,
    name: fields.name,
    bestOfSets: fields.bestOfSets,
    pointsToWin: fields.pointsToWin,
    winBy: fields.winBy,
    maxPoints: fields.maxPoints,
    deuceEnabled: fields.deuceEnabled,
    decidingSetPoints: fields.decidingSetPoints,
    decidingSetWinBy: fields.decidingSetWinBy,
    decidingSetMaxPoints: fields.decidingSetMaxPoints,
    changeEndsEnabled: fields.changeEndsEnabled,
    changeEndsAt: fields.changeEndsAt,
    createdAt: now,
    updatedAt: now,
  };
}
