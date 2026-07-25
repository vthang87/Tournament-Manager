import { eq } from "drizzle-orm";
import type {
  CreateTournamentEventInput,
  EventStatus,
  EventType,
  GenderCategory,
  TournamentEvent,
  UpdateTournamentEventInput,
} from "@/core/domain";
import type { TournamentEventRepository } from "@/application/ports";
import type { AppDatabase } from "@/db/client";
import { tournamentEvents } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";

function mapEvent(row: typeof tournamentEvents.$inferSelect): TournamentEvent {
  return {
    id: row.id,
    tournamentId: row.tournamentId,
    name: row.name,
    type: row.type as EventType,
    genderCategory: row.genderCategory as GenderCategory,
    status: row.status as EventStatus,
    defaultMatchRuleId: row.defaultMatchRuleId,
    thirdPlaceMatchEnabled: row.thirdPlaceMatchEnabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleTournamentEventRepository
  implements TournamentEventRepository
{
  constructor(private readonly db: AppDatabase) {}

  async create(input: CreateTournamentEventInput): Promise<TournamentEvent> {
    const now = nowIso();
    const row = {
      id: createId(),
      tournamentId: input.tournamentId,
      name: input.name,
      type: input.type,
      genderCategory: input.genderCategory,
      status: (input.status ?? "SETUP") as EventStatus,
      defaultMatchRuleId: input.defaultMatchRuleId ?? null,
      thirdPlaceMatchEnabled: input.thirdPlaceMatchEnabled ?? false,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(tournamentEvents).values(row);
    return mapEvent(row);
  }

  async findById(id: string): Promise<TournamentEvent | null> {
    const rows = await this.db
      .select()
      .from(tournamentEvents)
      .where(eq(tournamentEvents.id, id))
      .limit(1);
    return rows[0] ? mapEvent(rows[0]) : null;
  }

  async listByTournamentId(tournamentId: string): Promise<TournamentEvent[]> {
    const rows = await this.db
      .select()
      .from(tournamentEvents)
      .where(eq(tournamentEvents.tournamentId, tournamentId));
    return rows.map(mapEvent);
  }

  async update(
    id: string,
    input: UpdateTournamentEventInput,
  ): Promise<TournamentEvent | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    const now = nowIso();
    await this.db
      .update(tournamentEvents)
      .set({
        name: input.name ?? existing.name,
        type: input.type ?? existing.type,
        genderCategory: input.genderCategory ?? existing.genderCategory,
        defaultMatchRuleId:
          input.defaultMatchRuleId !== undefined
            ? input.defaultMatchRuleId
            : existing.defaultMatchRuleId,
        thirdPlaceMatchEnabled:
          input.thirdPlaceMatchEnabled ?? existing.thirdPlaceMatchEnabled,
        updatedAt: now,
      })
      .where(eq(tournamentEvents.id, id));
    return this.findById(id);
  }

  async updateStatus(
    id: string,
    status: EventStatus,
  ): Promise<TournamentEvent | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    await this.db
      .update(tournamentEvents)
      .set({ status, updatedAt: nowIso() })
      .where(eq(tournamentEvents.id, id));
    return this.findById(id);
  }
}
