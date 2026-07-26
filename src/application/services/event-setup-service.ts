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
import { createId, nowIso } from "@/lib/id";
import { and, eq } from "drizzle-orm";
import { TournamentAccessService } from "./tournament-access-service";

export class EventSetupService {
  private readonly events: DrizzleTournamentEventRepository;
  private readonly tournaments: DrizzleTournamentRepository;
  private readonly access: TournamentAccessService;

  constructor(private readonly db: AppDatabase) {
    this.events = new DrizzleTournamentEventRepository(db);
    this.tournaments = new DrizzleTournamentRepository(db);
    this.access = new TournamentAccessService(db);
  }

  listRulePresets(sportId?: string) {
    return sportId
      ? MATCH_RULE_PRESETS.filter((preset) => preset.sportId === sportId)
      : MATCH_RULE_PRESETS;
  }

  listSetupTemplates(sportId?: string) {
    return sportId
      ? EVENT_SETUP_TEMPLATES.filter((template) => template.sportId === sportId)
      : EVENT_SETUP_TEMPLATES;
  }

  private async assertEventSetup(actor: ActorContext, eventId: string) {
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
    await this.access.assert(actor, tournament.id, "setup");
    return { event, tournament };
  }

  /** Create a single rule from preset if name not already present. */
  async applyRulePreset(
    actor: ActorContext,
    eventId: string,
    presetId: string,
  ): Promise<{ rule: MatchRuleRecord; created: boolean }> {
    const { tournament } = await this.assertEventSetup(actor, eventId);
    const preset = getMatchRulePreset(presetId);
    if (!preset) {
      throw new ValidationError(
        `Unknown rule preset: ${presetId}`,
        "UNKNOWN_PRESET",
      );
    }
    if (preset.sportId !== tournament.sportId) {
      throw new ValidationError(
        "Rule preset does not belong to the tournament sport",
        "PRESET_SPORT_MISMATCH",
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

    return this.db.transaction(async (tx) => {
      const now = nowIso();
      const rule = buildRuleRow(eventId, preset.fields, now);
      await tx.insert(matchRules).values(rule)
      await writeAuditLog(tx, {
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
    const { event, tournament } = await this.assertEventSetup(actor, eventId);
    const template = getEventSetupTemplate(templateId);
    if (!template) {
      throw new ValidationError(
        `Unknown setup template: ${templateId}`,
        "UNKNOWN_TEMPLATE",
      );
    }
    if (template.sportId !== tournament.sportId) {
      throw new ValidationError(
        "Setup template does not belong to the tournament sport",
        "TEMPLATE_SPORT_MISMATCH",
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

    return this.db.transaction(async (tx) => {
      const now = nowIso();
      let replacedStages = 0;

      if (replace && existingStages.length > 0) {
        for (const stage of existingStages) {
          await tx.delete(stageRules).where(eq(stageRules.stageId, stage.id))
          await tx.delete(stages).where(eq(stages.id, stage.id))
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
        await tx.insert(matchRules).values(created)
        rulesByName.set(created.name, created);
        ruleIdByKey.set(def.key, created.id);
        rulesCreated += 1;
      }

      const defaultRuleId = ruleIdByKey.get(template.defaultRuleKey) ?? null;
      await tx.update(tournamentEvents)
        .set({
          defaultMatchRuleId: defaultRuleId,
          thirdPlaceMatchEnabled: template.thirdPlaceMatchEnabled ?? false,
          updatedAt: now,
        })
        .where(eq(tournamentEvents.id, eventId))
        

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
        await tx.insert(stages).values(row)
        await tx.insert(stageRules)
          .values({ stageId: row.id, matchRuleId })
          
        createdStages.push(row);
        stagesCreated += 1;
      }

      await writeAuditLog(tx, {
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
