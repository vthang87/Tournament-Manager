import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type {
  DrawResultRow,
  DrawSession,
  DrawSessionStatus,
  GroupEntry,
  TournamentGroup,
} from "@/core/domain";
import type { AppDatabase } from "@/db/client";
import {
  drawResults,
  drawSessions,
  groupEntries,
  groups,
} from "@/db/schema";
import { createId, nowIso } from "@/lib/id";

function mapGroup(row: typeof groups.$inferSelect): TournamentGroup {
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

function mapSession(row: typeof drawSessions.$inferSelect): DrawSession {
  return {
    id: row.id,
    eventId: row.eventId,
    stageId: row.stageId,
    randomSeed: row.randomSeed,
    configurationSnapshotJson: row.configurationSnapshotJson,
    status: row.status as DrawSessionStatus,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    confirmedAt: row.confirmedAt,
  };
}

export class DrizzleDrawRepository {
  constructor(private readonly db: AppDatabase) {}

  async listGroupsByStageId(stageId: string): Promise<TournamentGroup[]> {
    const rows = await this.db
      .select()
      .from(groups)
      .where(eq(groups.stageId, stageId))
      .orderBy(asc(groups.orderIndex));
    return rows.map(mapGroup);
  }

  async findGroupById(id: string): Promise<TournamentGroup | null> {
    const rows = await this.db
      .select()
      .from(groups)
      .where(eq(groups.id, id))
      .limit(1);
    return rows[0] ? mapGroup(rows[0]) : null;
  }

  async createGroups(
    stageId: string,
    defs: Array<{ name: string; code: string; orderIndex: number }>,
  ): Promise<TournamentGroup[]> {
    const now = nowIso();
    const rows = defs.map((def) => ({
      id: createId(),
      stageId,
      name: def.name,
      code: def.code,
      orderIndex: def.orderIndex,
      createdAt: now,
      updatedAt: now,
    }));
    if (rows.length > 0) {
      await this.db.insert(groups).values(rows);
    }
    return rows.map(mapGroup);
  }

  async findSessionById(id: string): Promise<DrawSession | null> {
    const rows = await this.db
      .select()
      .from(drawSessions)
      .where(eq(drawSessions.id, id))
      .limit(1);
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async findDraftByStageId(stageId: string): Promise<DrawSession | null> {
    const rows = await this.db
      .select()
      .from(drawSessions)
      .where(
        and(
          eq(drawSessions.stageId, stageId),
          eq(drawSessions.status, "DRAFT"),
        ),
      )
      .limit(1);
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async findLatestConfirmedByStageId(
    stageId: string,
  ): Promise<DrawSession | null> {
    const rows = await this.db
      .select()
      .from(drawSessions)
      .where(
        and(
          eq(drawSessions.stageId, stageId),
          inArray(drawSessions.status, ["CONFIRMED", "LOCKED"]),
        ),
      )
      .orderBy(asc(drawSessions.createdAt));
    const last = rows[rows.length - 1];
    return last ? mapSession(last) : null;
  }

  async listSessionsByEventId(eventId: string): Promise<DrawSession[]> {
    const rows = await this.db
      .select()
      .from(drawSessions)
      .where(eq(drawSessions.eventId, eventId))
      .orderBy(desc(drawSessions.createdAt));
    return rows.map(mapSession);
  }

  async listSessionsByStageId(stageId: string): Promise<DrawSession[]> {
    const rows = await this.db
      .select()
      .from(drawSessions)
      .where(eq(drawSessions.stageId, stageId))
      .orderBy(desc(drawSessions.createdAt));
    return rows.map(mapSession);
  }

  async listResults(drawSessionId: string): Promise<DrawResultRow[]> {
    const rows = await this.db
      .select()
      .from(drawResults)
      .where(eq(drawResults.drawSessionId, drawSessionId));
    return rows.map((row) => ({
      drawSessionId: row.drawSessionId,
      groupId: row.groupId,
      entryId: row.entryId,
      position: row.position,
    }));
  }

  async listGroupEntriesByStageId(stageId: string): Promise<GroupEntry[]> {
    const stageGroups = await this.listGroupsByStageId(stageId);
    if (stageGroups.length === 0) return [];
    const groupIds = stageGroups.map((g) => g.id);
    const rows = await this.db
      .select()
      .from(groupEntries)
      .where(inArray(groupEntries.groupId, groupIds));
    return rows.map((row) => ({
      groupId: row.groupId,
      entryId: row.entryId,
      position: row.position,
      seedPosition: row.seedPosition,
    }));
  }

  async listGroupEntriesByGroupId(groupId: string): Promise<GroupEntry[]> {
    const rows = await this.db
      .select()
      .from(groupEntries)
      .where(eq(groupEntries.groupId, groupId))
      .orderBy(asc(groupEntries.position));
    return rows.map((row) => ({
      groupId: row.groupId,
      entryId: row.entryId,
      position: row.position,
      seedPosition: row.seedPosition,
    }));
  }
}
