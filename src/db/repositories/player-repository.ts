import { and, eq, inArray, or, sql } from "drizzle-orm";
import type {
  CreatePlayerInput,
  Player,
  PlayerGender,
  PlayerSportProfile,
  UpdatePlayerInput,
} from "@/core/domain";
import type { AppDatabase } from "@/db/client";
import { players, playerSports } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import { matchesSearch } from "@/lib/normalize-search";

function mapPlayer(
  row: typeof players.$inferSelect,
  sports: PlayerSportProfile[] = [],
): Player {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    name: row.name,
    displayName: row.displayName,
    gender: row.gender as PlayerGender,
    dateOfBirth: row.dateOfBirth,
    phone: row.phone,
    email: row.email,
    metadataJson: row.metadataJson,
    sports,
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
      ownerUserId: input.ownerUserId,
      name: input.name,
      displayName: input.displayName,
      gender: (input.gender ?? "UNSPECIFIED") as PlayerGender,
      dateOfBirth: input.dateOfBirth ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      metadataJson: input.metadataJson ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.transaction(async (tx) => {
      await tx.insert(players).values(row);
      if (input.sports.length > 0) {
        await tx.insert(playerSports).values(
          input.sports.map((profile) => ({
            playerId: row.id,
            sportId: profile.sportId,
            clubId: profile.clubId ?? null,
            ranking: profile.ranking ?? null,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }
    });
    return this.findById(row.id) as Promise<Player>;
  }

  async findById(id: string, ownerUserId?: string): Promise<Player | null> {
    const rows = await this.db
      .select()
      .from(players)
      .where(
        ownerUserId
          ? and(eq(players.id, id), eq(players.ownerUserId, ownerUserId))
          : eq(players.id, id),
      )
      .limit(1);
    if (!rows[0]) {
      return null;
    }
    const profiles = await this.db
      .select()
      .from(playerSports)
      .where(eq(playerSports.playerId, id));
    return mapPlayer(rows[0], profiles);
  }

  async list(
    ownerUserId: string,
    query?: string,
    sportId?: string,
  ): Promise<Player[]> {
    const rows = await this.db
      .select()
      .from(players)
      .where(eq(players.ownerUserId, ownerUserId))
      .orderBy(sql`${players.displayName}`);
    const ids = rows.map((row) => row.id);
    const allProfiles =
      ids.length === 0
        ? []
        : await this.db
            .select()
            .from(playerSports)
            .where(inArray(playerSports.playerId, ids));
    const profilesByPlayer = new Map<string, PlayerSportProfile[]>();
    for (const profile of allProfiles) {
      const profiles = profilesByPlayer.get(profile.playerId) ?? [];
      profiles.push(profile);
      profilesByPlayer.set(profile.playerId, profiles);
    }
    const mapped = rows
      .map((row) => mapPlayer(row, profilesByPlayer.get(row.id) ?? []))
      .filter(
        (player) =>
          !sportId ||
          player.sports.some((profile) => profile.sportId === sportId),
      );
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
        metadataJson:
          input.metadataJson !== undefined
            ? input.metadataJson
            : existing.metadataJson,
        updatedAt: nowIso(),
      })
      .where(eq(players.id, id));
    return this.findById(id);
  }

  async findByNameExact(
    ownerUserId: string,
    name: string,
  ): Promise<Player | null> {
    const trimmed = name.trim();
    const rows = await this.db
      .select()
      .from(players)
      .where(
        and(
          eq(players.ownerUserId, ownerUserId),
          or(
            sql`lower(${players.name}) = lower(${trimmed})`,
            sql`lower(${players.displayName}) = lower(${trimmed})`,
          ),
        ),
      )
      .limit(1);
    return rows[0] ? mapPlayer(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(players).where(eq(players.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}
