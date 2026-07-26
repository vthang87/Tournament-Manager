import { and, eq, inArray, ne } from "drizzle-orm";
import type {
  CreateEntryInput,
  Entry,
  EntryMember,
  EntryMemberInput,
  EntryStatus,
  EntryWithMembers,
  UpdateEntryInput,
} from "@/core/domain";
import type { AppDatabase } from "@/db/client";
import { entries, entryMembers } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";

function mapEntry(row: typeof entries.$inferSelect): Entry {
  return {
    id: row.id,
    eventId: row.eventId,
    displayName: row.displayName,
    seed: row.seed,
    ranking: row.ranking,
    clubId: row.clubId,
    status: row.status as EntryStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleEntryRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateEntryInput): Promise<EntryWithMembers> {
    const now = nowIso();
    const row = {
      id: createId(),
      eventId: input.eventId,
      displayName: input.displayName,
      seed: input.seed ?? null,
      ranking: input.ranking ?? null,
      clubId: input.clubId ?? null,
      status: "ACTIVE" as EntryStatus,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(entries).values(row);
    await this.replaceMembers(row.id, input.members);
    return this.findByIdWithMembers(row.id) as Promise<EntryWithMembers>;
  }

  async findById(id: string): Promise<Entry | null> {
    const rows = await this.db
      .select()
      .from(entries)
      .where(eq(entries.id, id))
      .limit(1);
    return rows[0] ? mapEntry(rows[0]) : null;
  }

  async listMembers(entryId: string): Promise<EntryMember[]> {
    const rows = await this.db
      .select()
      .from(entryMembers)
      .where(eq(entryMembers.entryId, entryId));
    return rows.map((row) => ({
      entryId: row.entryId,
      playerId: row.playerId,
      position: row.position,
    }));
  }

  async findByIdWithMembers(id: string): Promise<EntryWithMembers | null> {
    const entry = await this.findById(id);
    if (!entry) {
      return null;
    }
    return { ...entry, members: await this.listMembers(id) };
  }

  async listByEventId(eventId: string): Promise<EntryWithMembers[]> {
    const rows = await this.db
      .select()
      .from(entries)
      .where(eq(entries.eventId, eventId));
    const result: EntryWithMembers[] = [];
    for (const row of rows) {
      const entry = mapEntry(row);
      result.push({ ...entry, members: await this.listMembers(entry.id) });
    }
    return result;
  }

  async findActiveBySeed(
    eventId: string,
    seed: number,
    excludeEntryId?: string,
  ): Promise<Entry | null> {
    const conditions = [
      eq(entries.eventId, eventId),
      eq(entries.seed, seed),
      eq(entries.status, "ACTIVE"),
    ];
    const rows = await this.db
      .select()
      .from(entries)
      .where(
        excludeEntryId
          ? and(...conditions, ne(entries.id, excludeEntryId))
          : and(...conditions),
      )
      .limit(1);
    return rows[0] ? mapEntry(rows[0]) : null;
  }

  async findActivePlayerMembership(
    eventId: string,
    playerId: string,
    excludeEntryId?: string,
  ): Promise<EntryMember | null> {
    const eventEntries = await this.db
      .select()
      .from(entries)
      .where(
        and(eq(entries.eventId, eventId), eq(entries.status, "ACTIVE")),
      );
    const entryIds = eventEntries
      .map((e) => e.id)
      .filter((id) => id !== excludeEntryId);
    if (entryIds.length === 0) {
      return null;
    }
    const rows = await this.db
      .select()
      .from(entryMembers)
      .where(
        and(
          inArray(entryMembers.entryId, entryIds),
          eq(entryMembers.playerId, playerId),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row
      ? {
          entryId: row.entryId,
          playerId: row.playerId,
          position: row.position,
        }
      : null;
  }

  async update(
    id: string,
    input: UpdateEntryInput,
  ): Promise<EntryWithMembers | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    await this.db
      .update(entries)
      .set({
        displayName: input.displayName ?? existing.displayName,
        seed: input.seed !== undefined ? input.seed : existing.seed,
        ranking: input.ranking !== undefined ? input.ranking : existing.ranking,
        clubId: input.clubId !== undefined ? input.clubId : existing.clubId,
        updatedAt: nowIso(),
      })
      .where(eq(entries.id, id));

    if (input.members) {
      await this.replaceMembers(id, input.members);
    }
    return this.findByIdWithMembers(id);
  }

  async updateStatus(
    id: string,
    status: EntryStatus,
  ): Promise<Entry | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    await this.db
      .update(entries)
      .set({ status, updatedAt: nowIso() })
      .where(eq(entries.id, id));
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    await this.db.delete(entryMembers).where(eq(entryMembers.entryId, id));
    const result = await this.db.delete(entries).where(eq(entries.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async replaceMembers(
    entryId: string,
    members: EntryMemberInput[],
  ): Promise<void> {
    await this.db.delete(entryMembers).where(eq(entryMembers.entryId, entryId));
    if (members.length === 0) {
      return;
    }
    await this.db.insert(entryMembers).values(
      members.map((m) => ({
        entryId,
        playerId: m.playerId,
        position: m.position,
      })),
    );
  }

  async countActiveByEventId(eventId: string): Promise<number> {
    const rows = await this.db
      .select()
      .from(entries)
      .where(and(eq(entries.eventId, eventId), eq(entries.status, "ACTIVE")));
    return rows.length;
  }
}
