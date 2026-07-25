import { and, eq } from "drizzle-orm";
import type {
  Court,
  CreateCourtInput,
  UpdateCourtInput,
} from "@/core/domain";
import type { AppDatabase } from "@/db/client";
import { courts } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";

function mapCourt(row: typeof courts.$inferSelect): Court {
  return {
    id: row.id,
    tournamentId: row.tournamentId,
    name: row.name,
    code: row.code,
    active: row.active,
    hasAccessPin: Boolean(row.accessPinHash),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleCourtRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateCourtInput): Promise<Court> {
    const now = nowIso();
    const row = {
      id: createId(),
      tournamentId: input.tournamentId,
      name: input.name,
      code: input.code,
      active: input.active ?? true,
      accessPinHash: null as string | null,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(courts).values(row);
    return mapCourt(row);
  }

  async findById(id: string): Promise<Court | null> {
    const rows = await this.db
      .select()
      .from(courts)
      .where(eq(courts.id, id))
      .limit(1);
    return rows[0] ? mapCourt(rows[0]) : null;
  }

  async findByIdWithPinHash(
    id: string,
  ): Promise<(Court & { accessPinHash: string | null }) | null> {
    const rows = await this.db
      .select()
      .from(courts)
      .where(eq(courts.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return null;
    }
    return { ...mapCourt(row), accessPinHash: row.accessPinHash };
  }

  async findByTournamentAndCode(
    tournamentId: string,
    code: string,
  ): Promise<Court | null> {
    const rows = await this.db
      .select()
      .from(courts)
      .where(and(eq(courts.tournamentId, tournamentId), eq(courts.code, code)))
      .limit(1);
    return rows[0] ? mapCourt(rows[0]) : null;
  }

  async findByTournamentAndCodeWithPinHash(
    tournamentId: string,
    code: string,
  ): Promise<(Court & { accessPinHash: string | null }) | null> {
    const rows = await this.db
      .select()
      .from(courts)
      .where(and(eq(courts.tournamentId, tournamentId), eq(courts.code, code)))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return null;
    }
    return { ...mapCourt(row), accessPinHash: row.accessPinHash };
  }

  async listByTournamentId(tournamentId: string): Promise<Court[]> {
    const rows = await this.db
      .select()
      .from(courts)
      .where(eq(courts.tournamentId, tournamentId));
    return rows.map(mapCourt);
  }

  async update(id: string, input: UpdateCourtInput): Promise<Court | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    await this.db
      .update(courts)
      .set({
        name: input.name ?? existing.name,
        code: input.code ?? existing.code,
        active: input.active ?? existing.active,
        updatedAt: nowIso(),
      })
      .where(eq(courts.id, id));
    return this.findById(id);
  }

  async setAccessPinHash(
    id: string,
    accessPinHash: string | null,
  ): Promise<Court | null> {
    await this.db
      .update(courts)
      .set({
        accessPinHash,
        updatedAt: nowIso(),
      })
      .where(eq(courts.id, id));
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(courts).where(eq(courts.id, id));
    return (result.changes ?? 0) > 0;
  }
}
