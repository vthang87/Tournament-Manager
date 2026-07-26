import { asc, eq } from "drizzle-orm";
import type {
  CreateMatchRuleInput,
  MatchRuleRecord,
  UpdateMatchRuleInput,
} from "@/core/domain";
import type { MatchRule } from "@/core/tournament-engine/match-rules/types";
import type { AppDatabase } from "@/db/client";
import { matchRules } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";

function mapRule(row: typeof matchRules.$inferSelect): MatchRuleRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    bestOfSets: row.bestOfSets,
    pointsToWin: row.pointsToWin,
    winBy: row.winBy,
    maxPoints: row.maxPoints,
    deuceEnabled: row.deuceEnabled,
    decidingSetPoints: row.decidingSetPoints,
    decidingSetWinBy: row.decidingSetWinBy,
    decidingSetMaxPoints: row.decidingSetMaxPoints,
    changeEndsEnabled: row.changeEndsEnabled,
    changeEndsAt: row.changeEndsAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toEngineMatchRule(rule: MatchRuleRecord): MatchRule {
  return { ...rule };
}

export class DrizzleMatchRuleRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateMatchRuleInput): Promise<MatchRuleRecord> {
    const now = nowIso();
    const row = {
      id: createId(),
      eventId: input.eventId,
      name: input.name,
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
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(matchRules).values(row);
    return mapRule(row);
  }

  async findById(id: string): Promise<MatchRuleRecord | null> {
    const rows = await this.db
      .select()
      .from(matchRules)
      .where(eq(matchRules.id, id))
      .limit(1);
    return rows[0] ? mapRule(rows[0]) : null;
  }

  async listByEventId(eventId: string): Promise<MatchRuleRecord[]> {
    const rows = await this.db
      .select()
      .from(matchRules)
      .where(eq(matchRules.eventId, eventId))
      .orderBy(asc(matchRules.name));
    return rows.map(mapRule);
  }

  async update(
    id: string,
    input: UpdateMatchRuleInput,
  ): Promise<MatchRuleRecord | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    await this.db
      .update(matchRules)
      .set({
        name: input.name ?? existing.name,
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
        changeEndsEnabled:
          input.changeEndsEnabled ?? existing.changeEndsEnabled,
        changeEndsAt:
          input.changeEndsAt !== undefined
            ? input.changeEndsAt
            : existing.changeEndsAt,
        updatedAt: nowIso(),
      })
      .where(eq(matchRules.id, id));
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(matchRules).where(eq(matchRules.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}
