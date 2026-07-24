import { and, asc, eq } from "drizzle-orm";
import type {
  CreateStageInput,
  Stage,
  StageFormat,
  StageRule,
  StageStatus,
  UpdateStageInput,
} from "@/core/domain";
import type { AppDatabase } from "@/db/client";
import { stageRules, stages } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";

function mapStage(row: typeof stages.$inferSelect): Stage {
  return {
    id: row.id,
    eventId: row.eventId,
    type: row.type,
    name: row.name,
    orderIndex: row.orderIndex,
    format: row.format as StageFormat,
    status: row.status as StageStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleStageRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(
    input: CreateStageInput,
  ): Promise<{ stage: Stage; stageRule: StageRule | null }> {
    const now = nowIso();
    const row = {
      id: createId(),
      eventId: input.eventId,
      type: input.type,
      name: input.name,
      orderIndex: input.orderIndex,
      format: input.format,
      status: "PENDING" as StageStatus,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(stages).values(row);

    let stageRule: StageRule | null = null;
    if (input.matchRuleId) {
      await this.db.insert(stageRules).values({
        stageId: row.id,
        matchRuleId: input.matchRuleId,
      });
      stageRule = { stageId: row.id, matchRuleId: input.matchRuleId };
    }

    return { stage: mapStage(row), stageRule };
  }

  async findById(id: string): Promise<Stage | null> {
    const rows = await this.db
      .select()
      .from(stages)
      .where(eq(stages.id, id))
      .limit(1);
    return rows[0] ? mapStage(rows[0]) : null;
  }

  async listByEventId(eventId: string): Promise<Stage[]> {
    const rows = await this.db
      .select()
      .from(stages)
      .where(eq(stages.eventId, eventId))
      .orderBy(asc(stages.orderIndex));
    return rows.map(mapStage);
  }

  async getStageRule(stageId: string): Promise<StageRule | null> {
    const rows = await this.db
      .select()
      .from(stageRules)
      .where(eq(stageRules.stageId, stageId))
      .limit(1);
    const row = rows[0];
    return row
      ? { stageId: row.stageId, matchRuleId: row.matchRuleId }
      : null;
  }

  async listStageRulesByEventId(eventId: string): Promise<StageRule[]> {
    const eventStages = await this.listByEventId(eventId);
    const result: StageRule[] = [];
    for (const stage of eventStages) {
      const rule = await this.getStageRule(stage.id);
      if (rule) {
        result.push(rule);
      }
    }
    return result;
  }

  async update(
    id: string,
    input: UpdateStageInput,
  ): Promise<{ stage: Stage; stageRule: StageRule | null } | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    await this.db
      .update(stages)
      .set({
        type: input.type ?? existing.type,
        name: input.name ?? existing.name,
        format: input.format ?? existing.format,
        updatedAt: nowIso(),
      })
      .where(eq(stages.id, id));

    if (input.matchRuleId !== undefined) {
      await this.setStageRule(id, input.matchRuleId);
    }

    const stage = await this.findById(id);
    if (!stage) {
      return null;
    }
    return { stage, stageRule: await this.getStageRule(id) };
  }

  async setStageRule(
    stageId: string,
    matchRuleId: string | null,
  ): Promise<StageRule | null> {
    await this.db.delete(stageRules).where(eq(stageRules.stageId, stageId));
    if (!matchRuleId) {
      return null;
    }
    await this.db.insert(stageRules).values({ stageId, matchRuleId });
    return { stageId, matchRuleId };
  }

  async updateOrderIndex(id: string, orderIndex: number): Promise<void> {
    await this.db
      .update(stages)
      .set({ orderIndex, updatedAt: nowIso() })
      .where(eq(stages.id, id));
  }

  async updateStatus(id: string, status: StageStatus): Promise<Stage | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    await this.db
      .update(stages)
      .set({ status, updatedAt: nowIso() })
      .where(eq(stages.id, id));
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    await this.db.delete(stageRules).where(eq(stageRules.stageId, id));
    const result = await this.db.delete(stages).where(eq(stages.id, id));
    return (result.changes ?? 0) > 0;
  }

  async findByEventAndOrder(
    eventId: string,
    orderIndex: number,
  ): Promise<Stage | null> {
    const rows = await this.db
      .select()
      .from(stages)
      .where(
        and(eq(stages.eventId, eventId), eq(stages.orderIndex, orderIndex)),
      )
      .limit(1);
    return rows[0] ? mapStage(rows[0]) : null;
  }
}
