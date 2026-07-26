import { eq, or } from "drizzle-orm";
import type {
  CreateTournamentInput,
  Tournament,
  TournamentStatus,
  UpdateTournamentInput,
} from "@/core/domain";
import type { TournamentRepository } from "@/application/ports";
import type { AppDatabase } from "@/db/client";
import { tournamentMembers, tournaments } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";

function mapTournament(row: typeof tournaments.$inferSelect): Tournament {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    sportId: row.sportId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    location: row.location,
    timezone: row.timezone,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status as TournamentStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleTournamentRepository implements TournamentRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateTournamentInput): Promise<Tournament> {
    const now = nowIso();
    const row = {
      id: createId(),
      ownerUserId: input.ownerUserId,
      sportId: input.sportId,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      location: input.location ?? null,
      timezone: input.timezone,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      status: (input.status ?? "DRAFT") as TournamentStatus,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(tournaments).values(row);
    return mapTournament(row);
  }

  async findById(id: string): Promise<Tournament | null> {
    const rows = await this.db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, id))
      .limit(1);
    return rows[0] ? mapTournament(rows[0]) : null;
  }

  async findBySlug(slug: string): Promise<Tournament | null> {
    const rows = await this.db
      .select()
      .from(tournaments)
      .where(eq(tournaments.slug, slug))
      .limit(1);
    return rows[0] ? mapTournament(rows[0]) : null;
  }

  async list(): Promise<Tournament[]> {
    const rows = await this.db.select().from(tournaments);
    return rows.map(mapTournament);
  }

  async listAccessibleByUser(userId: string): Promise<Tournament[]> {
    const rows = await this.db
      .selectDistinct({ tournament: tournaments })
      .from(tournaments)
      .leftJoin(
        tournamentMembers,
        eq(tournamentMembers.tournamentId, tournaments.id),
      )
      .where(
        or(
          eq(tournaments.ownerUserId, userId),
          eq(tournamentMembers.userId, userId),
        ),
      );
    return rows.map((row) => mapTournament(row.tournament));
  }

  async update(
    id: string,
    input: UpdateTournamentInput,
  ): Promise<Tournament | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    const now = nowIso();
    const next = {
      sportId: input.sportId ?? existing.sportId,
      name: input.name ?? existing.name,
      slug: input.slug ?? existing.slug,
      description:
        input.description !== undefined
          ? input.description
          : existing.description,
      location:
        input.location !== undefined ? input.location : existing.location,
      timezone: input.timezone ?? existing.timezone,
      startDate:
        input.startDate !== undefined ? input.startDate : existing.startDate,
      endDate: input.endDate !== undefined ? input.endDate : existing.endDate,
      updatedAt: now,
    };
    await this.db.update(tournaments).set(next).where(eq(tournaments.id, id));
    return this.findById(id);
  }

  async updateStatus(
    id: string,
    status: TournamentStatus,
  ): Promise<Tournament | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    await this.db
      .update(tournaments)
      .set({ status, updatedAt: nowIso() })
      .where(eq(tournaments.id, id));
    return this.findById(id);
  }
}
