import { and, asc, eq, isNull } from "drizzle-orm";
import type {
  CreateQualificationRuleInput,
  CreateScheduleRuleInput,
  CreateStandingRuleInput,
  GroupEntryRecord,
  GroupRecord,
  QualificationRuleRecord,
  ScheduleRuleRecord,
  StandingRuleRecord,
  UpdateScheduleRuleInput,
} from "@/core/domain";
import type { AppDatabase } from "@/db/client";
import {
  groupEntries,
  groups,
  qualificationRules,
  scheduleRules,
  standingRules,
} from "@/db/schema";
import { createId, nowIso } from "@/lib/id";

function mapGroup(row: typeof groups.$inferSelect): GroupRecord {
  return {
    id: row.id,
    stageId: row.stageId,
    name: row.name,
    code: row.code,
    orderIndex: row.orderIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapGroupEntry(
  row: typeof groupEntries.$inferSelect,
): GroupEntryRecord {
  return {
    groupId: row.groupId,
    entryId: row.entryId,
    position: row.position,
    seedPosition: row.seedPosition,
  };
}

function mapStandingRule(
  row: typeof standingRules.$inferSelect,
): StandingRuleRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    criteriaJson: row.criteriaJson,
    specialPolicyJson: row.specialPolicyJson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapQualificationRule(
  row: typeof qualificationRules.$inferSelect,
): QualificationRuleRecord {
  return {
    id: row.id,
    sourceStageId: row.sourceStageId,
    targetStageId: row.targetStageId,
    topPerGroup: row.topPerGroup,
    bestAdditionalEntries: row.bestAdditionalEntries,
    additionalFromRank: row.additionalFromRank,
    rankingCriteriaJson: row.rankingCriteriaJson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapScheduleRule(
  row: typeof scheduleRules.$inferSelect,
): ScheduleRuleRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    stageId: row.stageId,
    defaultMatchDurationMinutes: row.defaultMatchDurationMinutes,
    minimumRestMinutes: row.minimumRestMinutes,
    courtChangeBufferMinutes: row.courtChangeBufferMinutes,
    hardRestConflicts: row.hardRestConflicts,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleGroupRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: {
    stageId: string;
    name: string;
    code: string;
    orderIndex: number;
  }): Promise<GroupRecord> {
    const now = nowIso();
    const row = {
      id: createId(),
      stageId: input.stageId,
      name: input.name,
      code: input.code,
      orderIndex: input.orderIndex,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(groups).values(row);
    return mapGroup(row);
  }

  async findById(id: string): Promise<GroupRecord | null> {
    const rows = await this.db
      .select()
      .from(groups)
      .where(eq(groups.id, id))
      .limit(1);
    return rows[0] ? mapGroup(rows[0]) : null;
  }

  async listByStageId(stageId: string): Promise<GroupRecord[]> {
    const rows = await this.db
      .select()
      .from(groups)
      .where(eq(groups.stageId, stageId))
      .orderBy(asc(groups.orderIndex));
    return rows.map(mapGroup);
  }

  async listEntries(groupId: string): Promise<GroupEntryRecord[]> {
    const rows = await this.db
      .select()
      .from(groupEntries)
      .where(eq(groupEntries.groupId, groupId))
      .orderBy(asc(groupEntries.position));
    return rows.map(mapGroupEntry);
  }

  async addEntry(input: {
    groupId: string;
    entryId: string;
    position: number;
    seedPosition?: number | null;
  }): Promise<GroupEntryRecord> {
    const row = {
      groupId: input.groupId,
      entryId: input.entryId,
      position: input.position,
      seedPosition: input.seedPosition ?? null,
    };
    await this.db.insert(groupEntries).values(row);
    return mapGroupEntry(row);
  }
}

export class DrizzleStandingRuleRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateStandingRuleInput): Promise<StandingRuleRecord> {
    const now = nowIso();
    const row = {
      id: createId(),
      eventId: input.eventId,
      name: input.name,
      criteriaJson: input.criteriaJson,
      specialPolicyJson: input.specialPolicyJson ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(standingRules).values(row);
    return mapStandingRule(row);
  }

  async findById(id: string): Promise<StandingRuleRecord | null> {
    const rows = await this.db
      .select()
      .from(standingRules)
      .where(eq(standingRules.id, id))
      .limit(1);
    return rows[0] ? mapStandingRule(rows[0]) : null;
  }

  async listByEventId(eventId: string): Promise<StandingRuleRecord[]> {
    const rows = await this.db
      .select()
      .from(standingRules)
      .where(eq(standingRules.eventId, eventId))
      .orderBy(asc(standingRules.name));
    return rows.map(mapStandingRule);
  }

  async findDefaultForEvent(
    eventId: string,
  ): Promise<StandingRuleRecord | null> {
    const list = await this.listByEventId(eventId);
    return list[0] ?? null;
  }
}

export class DrizzleQualificationRuleRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(
    input: CreateQualificationRuleInput,
  ): Promise<QualificationRuleRecord> {
    const now = nowIso();
    const row = {
      id: createId(),
      sourceStageId: input.sourceStageId,
      targetStageId: input.targetStageId,
      topPerGroup: input.topPerGroup,
      bestAdditionalEntries: input.bestAdditionalEntries ?? 0,
      additionalFromRank: input.additionalFromRank ?? null,
      rankingCriteriaJson: input.rankingCriteriaJson ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(qualificationRules).values(row);
    return mapQualificationRule(row);
  }

  async findByStages(
    sourceStageId: string,
    targetStageId: string,
  ): Promise<QualificationRuleRecord | null> {
    const rows = await this.db
      .select()
      .from(qualificationRules)
      .where(
        and(
          eq(qualificationRules.sourceStageId, sourceStageId),
          eq(qualificationRules.targetStageId, targetStageId),
        ),
      )
      .limit(1);
    return rows[0] ? mapQualificationRule(rows[0]) : null;
  }

  async findBySourceStage(
    sourceStageId: string,
  ): Promise<QualificationRuleRecord | null> {
    const rows = await this.db
      .select()
      .from(qualificationRules)
      .where(eq(qualificationRules.sourceStageId, sourceStageId))
      .limit(1);
    return rows[0] ? mapQualificationRule(rows[0]) : null;
  }
}

export class DrizzleScheduleRuleRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateScheduleRuleInput): Promise<ScheduleRuleRecord> {
    const now = nowIso();
    const row = {
      id: createId(),
      eventId: input.eventId,
      stageId: input.stageId ?? null,
      defaultMatchDurationMinutes: input.defaultMatchDurationMinutes ?? 45,
      minimumRestMinutes: input.minimumRestMinutes ?? 15,
      courtChangeBufferMinutes: input.courtChangeBufferMinutes ?? 5,
      hardRestConflicts: input.hardRestConflicts ?? false,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(scheduleRules).values(row);
    return mapScheduleRule(row);
  }

  async findById(id: string): Promise<ScheduleRuleRecord | null> {
    const rows = await this.db
      .select()
      .from(scheduleRules)
      .where(eq(scheduleRules.id, id))
      .limit(1);
    return rows[0] ? mapScheduleRule(rows[0]) : null;
  }

  async listByEventId(eventId: string): Promise<ScheduleRuleRecord[]> {
    const rows = await this.db
      .select()
      .from(scheduleRules)
      .where(eq(scheduleRules.eventId, eventId))
      .orderBy(asc(scheduleRules.createdAt));
    return rows.map(mapScheduleRule);
  }

  async findEventDefault(eventId: string): Promise<ScheduleRuleRecord | null> {
    const rows = await this.db
      .select()
      .from(scheduleRules)
      .where(
        and(eq(scheduleRules.eventId, eventId), isNull(scheduleRules.stageId)),
      )
      .limit(1);
    return rows[0] ? mapScheduleRule(rows[0]) : null;
  }

  async findForStage(
    eventId: string,
    stageId: string,
  ): Promise<ScheduleRuleRecord | null> {
    const rows = await this.db
      .select()
      .from(scheduleRules)
      .where(
        and(
          eq(scheduleRules.eventId, eventId),
          eq(scheduleRules.stageId, stageId),
        ),
      )
      .limit(1);
    return rows[0] ? mapScheduleRule(rows[0]) : null;
  }

  /**
   * Stage override wins over event default.
   */
  async resolveForStage(
    eventId: string,
    stageId: string | null,
  ): Promise<ScheduleRuleRecord | null> {
    if (stageId) {
      const stageRule = await this.findForStage(eventId, stageId);
      if (stageRule) {
        return stageRule;
      }
    }
    return this.findEventDefault(eventId);
  }

  async update(
    id: string,
    input: UpdateScheduleRuleInput,
  ): Promise<ScheduleRuleRecord | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    await this.db
      .update(scheduleRules)
      .set({
        defaultMatchDurationMinutes:
          input.defaultMatchDurationMinutes ??
          existing.defaultMatchDurationMinutes,
        minimumRestMinutes:
          input.minimumRestMinutes ?? existing.minimumRestMinutes,
        courtChangeBufferMinutes:
          input.courtChangeBufferMinutes ?? existing.courtChangeBufferMinutes,
        hardRestConflicts:
          input.hardRestConflicts ?? existing.hardRestConflicts,
        updatedAt: nowIso(),
      })
      .where(eq(scheduleRules.id, id));
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(scheduleRules)
      .where(eq(scheduleRules.id, id));
    return (result.changes ?? 0) > 0;
  }
}
