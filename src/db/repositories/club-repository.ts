import { and, eq, sql } from "drizzle-orm";
import type {
  Club,
  CreateClubInput,
  UpdateClubInput,
} from "@/core/domain";
import type { AppDatabase } from "@/db/client";
import { clubs } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import { matchesSearch } from "@/lib/normalize-search";

function mapClub(row: typeof clubs.$inferSelect): Club {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    name: row.name,
    shortName: row.shortName,
    logoUrl: row.logoUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleClubRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateClubInput): Promise<Club> {
    const now = nowIso();
    const row = {
      id: createId(),
      ownerUserId: input.ownerUserId,
      name: input.name,
      shortName: input.shortName ?? null,
      logoUrl: input.logoUrl ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(clubs).values(row);
    return mapClub(row);
  }

  async findById(id: string, ownerUserId?: string): Promise<Club | null> {
    const rows = await this.db
      .select()
      .from(clubs)
      .where(
        ownerUserId
          ? and(eq(clubs.id, id), eq(clubs.ownerUserId, ownerUserId))
          : eq(clubs.id, id),
      )
      .limit(1);
    return rows[0] ? mapClub(rows[0]) : null;
  }

  async list(ownerUserId: string, query?: string): Promise<Club[]> {
    const rows = await this.db
      .select()
      .from(clubs)
      .where(eq(clubs.ownerUserId, ownerUserId))
      .orderBy(sql`${clubs.name}`);
    const mapped = rows.map(mapClub);
    const q = query?.trim();
    if (!q) {
      return mapped;
    }
    return mapped.filter(
      (club) =>
        matchesSearch(club.name, q) ||
        (club.shortName != null && matchesSearch(club.shortName, q)),
    );
  }

  async update(id: string, input: UpdateClubInput): Promise<Club | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    await this.db
      .update(clubs)
      .set({
        name: input.name ?? existing.name,
        shortName:
          input.shortName !== undefined ? input.shortName : existing.shortName,
        logoUrl:
          input.logoUrl !== undefined ? input.logoUrl : existing.logoUrl,
        updatedAt: nowIso(),
      })
      .where(eq(clubs.id, id));
    return this.findById(id);
  }

  async findByNameExact(
    ownerUserId: string,
    name: string,
  ): Promise<Club | null> {
    const rows = await this.db
      .select()
      .from(clubs)
      .where(
        and(
          eq(clubs.ownerUserId, ownerUserId),
          sql`lower(${clubs.name}) = lower(${name.trim()})`,
        ),
      )
      .limit(1);
    return rows[0] ? mapClub(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(clubs).where(eq(clubs.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}
