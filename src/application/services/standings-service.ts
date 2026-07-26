import { NotFoundError, ValidationError } from "@/application/errors";
import type { ActorContext, StandingRuleRecord } from "@/core/domain";
import {
  DEFAULT_SPECIAL_POLICY,
  DEFAULT_STANDING_CRITERIA,
  calculateStandings,
  defaultStandingRule,
  standingCriterionSchema,
  standingsSpecialPolicySchema,
  type StandingCriterion,
  type StandingMatch,
  type StandingRow,
  type StandingRule,
  type StandingsSpecialPolicy,
} from "@/core/tournament-engine/standings";
import type { AppDatabase } from "@/db/client";
import { DrizzleMatchRepository } from "@/db/repositories/match-repository";
import {
  DrizzleGroupRepository,
  DrizzleStandingRuleRepository,
} from "@/db/repositories/schedule-repository";
import { writeAuditLog } from "@/lib/audit";
import {
  createStandingRuleSchema,
  parseOrThrow,
} from "@/lib/validation/schemas";
import { TournamentAccessService } from "./tournament-access-service";

export type StandingsResult = {
  groupId: string | null;
  stageId: string;
  rule: StandingRule;
  rows: StandingRow[];
};

function parseCriteria(json: string): StandingCriterion[] {
  const parsed = JSON.parse(json) as unknown;
  if (!Array.isArray(parsed)) {
    throw new ValidationError("criteria_json must be an array");
  }
  return parsed.map((item) => standingCriterionSchema.parse(item));
}

function parseSpecialPolicy(
  json: string | null,
): StandingsSpecialPolicy | undefined {
  if (!json) {
    return undefined;
  }
  return standingsSpecialPolicySchema.parse(JSON.parse(json));
}

function toStandingRule(record: StandingRuleRecord): StandingRule {
  return {
    criteria: parseCriteria(record.criteriaJson),
    specialPolicy: parseSpecialPolicy(record.specialPolicyJson),
  };
}

/**
 * On-demand standings calculation from match source of truth.
 */
export class StandingsService {
  private readonly matches: DrizzleMatchRepository;
  private readonly groups: DrizzleGroupRepository;
  private readonly standingRules: DrizzleStandingRuleRepository;
  private readonly access: TournamentAccessService;

  constructor(private readonly db: AppDatabase) {
    this.matches = new DrizzleMatchRepository(db);
    this.groups = new DrizzleGroupRepository(db);
    this.standingRules = new DrizzleStandingRuleRepository(db);
    this.access = new TournamentAccessService(db);
  }

  async createStandingRule(
    actor: ActorContext,
    raw: unknown,
  ): Promise<StandingRuleRecord> {
    const input = parseOrThrow(createStandingRuleSchema, raw);
    await this.access.assertForEvent(actor, input.eventId, "setup");
    const criteria = input.criteria.map((c) =>
      standingCriterionSchema.parse(c),
    );
    let specialPolicyJson: string | null = null;
    if (input.specialPolicy !== undefined) {
      specialPolicyJson = JSON.stringify(
        standingsSpecialPolicySchema.parse(input.specialPolicy),
      );
    }

    const created = await this.standingRules.create({
      eventId: input.eventId,
      name: input.name,
      criteriaJson: JSON.stringify(criteria),
      specialPolicyJson,
    });

    this.db.transaction(async (tx) => {
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "standing_rule.create",
        entityType: "standing_rule",
        entityId: created.id,
        after: created,
      });
    });

    return created;
  }

  async resolveRule(eventId: string, ruleId?: string): Promise<StandingRule> {
    if (ruleId) {
      const record = await this.standingRules.findById(ruleId);
      if (!record) {
        throw new NotFoundError(`Standing rule ${ruleId} not found`);
      }
      return toStandingRule(record);
    }
    const existing = await this.standingRules.findDefaultForEvent(eventId);
    if (existing) {
      return toStandingRule(existing);
    }
    return defaultStandingRule({
      criteria: [...DEFAULT_STANDING_CRITERIA],
      specialPolicy: DEFAULT_SPECIAL_POLICY,
    });
  }

  async calculateForGroup(
    groupId: string,
    options?: { ruleId?: string; eventId?: string },
  ): Promise<StandingsResult> {
    const group = await this.groups.findById(groupId);
    if (!group) {
      throw new NotFoundError(`Group ${groupId} not found`);
    }
    const entries = await this.groups.listEntries(groupId);
    const matchRows = await this.matches.listByGroupId(groupId);
    const withSets = await Promise.all(
      matchRows.map(async (m) => {
        const sets = await this.matches.listSets(m.id);
        return { match: m, sets };
      }),
    );

    const standingMatches: StandingMatch[] = withSets
      .filter(({ match }) => match.status !== "CANCELLED")
      .map(({ match, sets }) => ({
        id: match.id,
        entryAId: match.entryAId ?? "",
        entryBId: match.entryBId ?? "",
        winnerEntryId: match.winnerEntryId,
        resolution: match.resolution ?? undefined,
        sets: sets.map((s) => ({ scoreA: s.scoreA, scoreB: s.scoreB })),
      }))
      .filter((m) => m.entryAId && m.entryBId);

    let eventId = options?.eventId;
    if (!eventId && matchRows[0]) {
      eventId = matchRows[0].eventId;
    }
    const rule = eventId
      ? await this.resolveRule(eventId, options?.ruleId)
      : defaultStandingRule();

    const rows = calculateStandings({
      entries: entries.map((e) => ({ id: e.entryId })),
      matches: standingMatches,
      rule,
    });

    return {
      groupId,
      stageId: group.stageId,
      rule,
      rows,
    };
  }

  async calculateForStage(
    stageId: string,
    options?: { ruleId?: string; eventId?: string },
  ): Promise<StandingsResult[]> {
    const stageGroups = await this.groups.listByStageId(stageId);
    const results: StandingsResult[] = [];
    for (const group of stageGroups) {
      results.push(await this.calculateForGroup(group.id, options));
    }
    return results;
  }
}
