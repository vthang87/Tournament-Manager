import { eq, or, sql } from "drizzle-orm";
import type {
  CreatePlayerInput,
  Player,
  PlayerGender,
  UpdatePlayerInput,
} from "@/core/domain";
import type { AppDatabase } from "@/db/client";
import { players } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import { matchesSearch } from "@/lib/normalize-search";

function mapPlayer(row: typeof players.$inferSelect): Player {
  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    gender: row.gender as PlayerGender,
    dateOfBirth: row.dateOfBirth,
    phone: row.phone,
    email: row.email,
    clubId: row.clubId,
    ranking: row.ranking,
    metadataJson: row.metadataJson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzlePlayerRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreatePlayerInput): Promise<Player> {
    const now = nowIso();
    const row = {
      id: createId(),
      name: input.name,
      displayName: input.displayName,
      gender: (input.gender ?? "UNSPECIFIED") as PlayerGender,
      dateOfBirth: input.dateOfBirth ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      clubId: input.clubId ?? null,
      ranking: input.ranking ?? null,
      metadataJson: input.metadataJson ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(players).values(row);
    return mapPlayer(row);
  }

  async findById(id: string): Promise<Player | null> {
    const rows = await this.db
      .select()
      .from(players)
      .where(eq(players.id, id))
      .limit(1);
    return rows[0] ? mapPlayer(rows[0]) : null;
  }

  async list(query?: string): Promise<Player[]> {
    const rows = await this.db
      .select()
      .from(players)
      .orderBy(sql`${players.displayName}`);
    const mapped = rows.map(mapPlayer);
    const q = query?.trim();
    if (!q) {
      return mapped;
    }
    return mapped.filter(
      (player) =>
        matchesSearch(player.name, q) ||
        matchesSearch(player.displayName, q) ||
        (player.email != null && matchesSearch(player.email, q)),
    );
  }

  async update(id: string, input: UpdatePlayerInput): Promise<Player | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    await this.db
      .update(players)
      .set({
        name: input.name ?? existing.name,
        displayName: input.displayName ?? existing.displayName,
        gender: input.gender ?? existing.gender,
        dateOfBirth:
          input.dateOfBirth !== undefined
            ? input.dateOfBirth
            : existing.dateOfBirth,
        phone: input.phone !== undefined ? input.phone : existing.phone,
        email: input.email !== undefined ? input.email : existing.email,
        clubId: input.clubId !== undefined ? input.clubId : existing.clubId,
        ranking:
          input.ranking !== undefined ? input.ranking : existing.ranking,
        metadataJson:
          input.metadataJson !== undefined
            ? input.metadataJson
            : existing.metadataJson,
        updatedAt: nowIso(),
      })
      .where(eq(players.id, id));
    return this.findById(id);
  }

  async findByNameExact(name: string): Promise<Player | null> {
    const trimmed = name.trim();
    const rows = await this.db
      .select()
      .from(players)
      .where(
        or(
          sql`lower(${players.name}) = lower(${trimmed})`,
          sql`lower(${players.displayName}) = lower(${trimmed})`,
        ),
      )
      .limit(1);
    return rows[0] ? mapPlayer(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(players).where(eq(players.id, id));
    return (result.changes ?? 0) > 0;
  }
}
