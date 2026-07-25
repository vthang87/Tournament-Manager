import { NotFoundError } from "@/application/errors";
import type { ActorContext, Club, UpdateClubInput } from "@/core/domain";
import type { AppDatabase } from "@/db/client";
import { DrizzleClubRepository } from "@/db/repositories/club-repository";
import { clubs } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { assertCanPerform } from "@/lib/auth/policies";
import { createId, nowIso } from "@/lib/id";
import {
  createClubSchema,
  parseOrThrow,
  updateClubSchema,
} from "@/lib/validation/schemas";
import { eq } from "drizzle-orm";

export class ClubService {
  private readonly clubs: DrizzleClubRepository;

  constructor(private readonly db: AppDatabase) {
    this.clubs = new DrizzleClubRepository(db);
  }

  list(query?: string) {
    return this.clubs.list(query);
  }

  async getById(id: string): Promise<Club> {
    const club = await this.clubs.findById(id);
    if (!club) {
      throw new NotFoundError(`Club ${id} not found`);
    }
    return club;
  }

  async create(actor: ActorContext, raw: unknown): Promise<Club> {
    assertCanPerform(actor.role, "import");
    const input = parseOrThrow(createClubSchema, raw);

    return this.db.transaction(async (tx) => {
      const now = nowIso();
      const row = {
        id: createId(),
        name: input.name,
        shortName: input.shortName ?? null,
        logoUrl: input.logoUrl ?? null,
        createdAt: now,
        updatedAt: now,
      };
      await tx.insert(clubs).values(row)
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "club.create",
        entityType: "club",
        entityId: row.id,
        after: row,
      });
      return row;
    });
  }

  async update(actor: ActorContext, id: string, raw: unknown): Promise<Club> {
    assertCanPerform(actor.role, "import");
    const input = parseOrThrow(updateClubSchema, raw) as UpdateClubInput;
    const existing = await this.getById(id);

    return this.db.transaction(async (tx) => {
      const updatedAt = nowIso();
      const next = {
        name: input.name ?? existing.name,
        shortName:
          input.shortName !== undefined ? input.shortName : existing.shortName,
        logoUrl:
          input.logoUrl !== undefined ? input.logoUrl : existing.logoUrl,
        updatedAt,
      };
      await tx.update(clubs).set(next).where(eq(clubs.id, id))
      const updated = { ...existing, ...next };
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "club.update",
        entityType: "club",
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });
  }

  async delete(actor: ActorContext, id: string): Promise<void> {
    assertCanPerform(actor.role, "import");
    const existing = await this.getById(id);
    this.db.transaction(async (tx) => {
      await tx.delete(clubs).where(eq(clubs.id, id))
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "club.delete",
        entityType: "club",
        entityId: id,
        before: existing,
      });
    });
  }
}
