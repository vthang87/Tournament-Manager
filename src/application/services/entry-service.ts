import {
  ConflictError,
  DomainStateError,
  NotFoundError,
  ValidationError,
} from "@/application/errors";
import type {
  ActorContext,
  EntryStatus,
  EntryWithMembers,
  UpdateEntryInput,
} from "@/core/domain";
import { assertMemberCardinality } from "@/core/domain/entry-rules";
import {
  assertEventMutable,
  assertTournamentNotArchived,
} from "@/core/domain/state-machines";
import type { AppDatabase } from "@/db/client";
import { DrizzleClubRepository } from "@/db/repositories/club-repository";
import { DrizzleEntryRepository } from "@/db/repositories/entry-repository";
import { DrizzlePlayerRepository } from "@/db/repositories/player-repository";
import { DrizzleTournamentEventRepository } from "@/db/repositories/tournament-event-repository";
import { DrizzleTournamentRepository } from "@/db/repositories/tournament-repository";
import { entries, entryMembers } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { assertCanPerform } from "@/lib/auth/policies";
import { createId, nowIso } from "@/lib/id";
import {
  createEntrySchema,
  parseOrThrow,
  updateEntrySchema,
} from "@/lib/validation/schemas";
import { eq } from "drizzle-orm";

export type EntryValidationSummary = {
  total: number;
  active: number;
  withdrawn: number;
  disqualified: number;
  seeded: number;
  invalid: { entryId: string; displayName: string; errors: string[] }[];
};

export class EntryService {
  private readonly entries: DrizzleEntryRepository;
  private readonly events: DrizzleTournamentEventRepository;
  private readonly tournaments: DrizzleTournamentRepository;
  private readonly players: DrizzlePlayerRepository;
  private readonly clubs: DrizzleClubRepository;

  constructor(private readonly db: AppDatabase) {
    this.entries = new DrizzleEntryRepository(db);
    this.events = new DrizzleTournamentEventRepository(db);
    this.tournaments = new DrizzleTournamentRepository(db);
    this.players = new DrizzlePlayerRepository(db);
    this.clubs = new DrizzleClubRepository(db);
  }

  listByEvent(eventId: string) {
    return this.entries.listByEventId(eventId);
  }

  /** Player IDs already on an ACTIVE entry in this event (optionally excluding one entry). */
  async listRegisteredPlayerIds(
    eventId: string,
    excludeEntryId?: string,
  ): Promise<string[]> {
    const list = await this.entries.listByEventId(eventId);
    const ids = new Set<string>();
    for (const entry of list) {
      if (entry.status !== "ACTIVE") continue;
      if (excludeEntryId && entry.id === excludeEntryId) continue;
      for (const member of entry.members) {
        ids.add(member.playerId);
      }
    }
    return [...ids];
  }

  async getById(id: string): Promise<EntryWithMembers> {
    const entry = await this.entries.findByIdWithMembers(id);
    if (!entry) {
      throw new NotFoundError(`Entry ${id} not found`);
    }
    return entry;
  }

  private async assertEventAllowsEntryEdits(eventId: string) {
    const event = await this.events.findById(eventId);
    if (!event) {
      throw new NotFoundError(`Event ${eventId} not found`);
    }
    // Entries can be managed during SETUP (and REGISTRATION conceptually);
    // after DRAW_CONFIRMED, only withdraw/DQ — enforce SETUP for create/update.
    if (event.status !== "SETUP" && event.status !== "DRAW_READY") {
      throw new DomainStateError(
        `Entries cannot be edited while event is ${event.status}`,
        "EVENT_ENTRIES_LOCKED",
      );
    }
    const tournament = await this.tournaments.findById(event.tournamentId);
    if (!tournament) {
      throw new NotFoundError(`Tournament ${event.tournamentId} not found`);
    }
    assertTournamentNotArchived(tournament.status);
    return event;
  }

  private async assertPlayersExist(playerIds: string[]) {
    for (const playerId of playerIds) {
      const player = await this.players.findById(playerId);
      if (!player) {
        throw new NotFoundError(`Player ${playerId} not found`);
      }
    }
  }

  private async assertNoDuplicateMembership(
    eventId: string,
    playerIds: string[],
    excludeEntryId?: string,
  ) {
    for (const playerId of playerIds) {
      const existing = await this.entries.findActivePlayerMembership(
        eventId,
        playerId,
        excludeEntryId,
      );
      if (existing) {
        throw new ConflictError(
          `Player ${playerId} is already in an active entry for this event`,
        );
      }
    }
  }

  private async assertUniqueSeed(
    eventId: string,
    seed: number | null | undefined,
    excludeEntryId?: string,
  ) {
    if (seed == null) {
      return;
    }
    const clash = await this.entries.findActiveBySeed(
      eventId,
      seed,
      excludeEntryId,
    );
    if (clash) {
      throw new ConflictError(
        `Seed ${seed} is already assigned to another active entry`,
      );
    }
  }

  async create(
    actor: ActorContext,
    raw: unknown,
  ): Promise<EntryWithMembers> {
    assertCanPerform(actor.role, "import");
    const input = parseOrThrow(createEntrySchema, raw);
    const event = await this.assertEventAllowsEntryEdits(input.eventId);
    assertEventMutable(event.status);

    assertMemberCardinality(event.type, input.members);
    await this.assertPlayersExist(input.members.map((m) => m.playerId));
    await this.assertNoDuplicateMembership(
      input.eventId,
      input.members.map((m) => m.playerId),
    );
    await this.assertUniqueSeed(input.eventId, input.seed ?? null);

    if (input.clubId) {
      const club = await this.clubs.findById(input.clubId);
      if (!club) {
        throw new NotFoundError(`Club ${input.clubId} not found`);
      }
    }

    return this.db.transaction(async (tx) => {
      const now = nowIso();
      const row = {
        id: createId(),
        eventId: input.eventId,
        displayName: input.displayName,
        seed: input.seed ?? null,
        ranking: input.ranking ?? null,
        clubId: input.clubId ?? null,
        status: "ACTIVE" as const,
        createdAt: now,
        updatedAt: now,
      };
      await tx.insert(entries).values(row)
      for (const member of input.members) {
        await tx.insert(entryMembers)
          .values({
            entryId: row.id,
            playerId: member.playerId,
            position: member.position,
          })
          
      }
      const created: EntryWithMembers = {
        ...row,
        members: input.members.map((m) => ({
          entryId: row.id,
          playerId: m.playerId,
          position: m.position,
        })),
      };
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "entry.create",
        entityType: "entry",
        entityId: row.id,
        after: created,
      });
      return created;
    });
  }

  async update(
    actor: ActorContext,
    id: string,
    raw: unknown,
  ): Promise<EntryWithMembers> {
    assertCanPerform(actor.role, "import");
    const input = parseOrThrow(updateEntrySchema, raw) as UpdateEntryInput;
    const existing = await this.getById(id);
    if (existing.status !== "ACTIVE") {
      throw new DomainStateError(
        "Only ACTIVE entries can be updated",
        "ENTRY_NOT_ACTIVE",
      );
    }
    const event = await this.assertEventAllowsEntryEdits(existing.eventId);
    assertEventMutable(event.status);

    const members = input.members ?? existing.members;
    assertMemberCardinality(event.type, members);
    await this.assertPlayersExist(members.map((m) => m.playerId));
    await this.assertNoDuplicateMembership(
      existing.eventId,
      members.map((m) => m.playerId),
      id,
    );
    await this.assertUniqueSeed(
      existing.eventId,
      input.seed !== undefined ? input.seed : existing.seed,
      id,
    );

    if (input.clubId) {
      const club = await this.clubs.findById(input.clubId);
      if (!club) {
        throw new NotFoundError(`Club ${input.clubId} not found`);
      }
    }

    return this.db.transaction(async (tx) => {
      const updatedAt = nowIso();
      const next = {
        displayName: input.displayName ?? existing.displayName,
        seed: input.seed !== undefined ? input.seed : existing.seed,
        ranking: input.ranking !== undefined ? input.ranking : existing.ranking,
        clubId: input.clubId !== undefined ? input.clubId : existing.clubId,
        updatedAt,
      };
      await tx.update(entries).set(next).where(eq(entries.id, id))

      if (input.members) {
        await tx.delete(entryMembers).where(eq(entryMembers.entryId, id))
        for (const member of input.members) {
          await tx.insert(entryMembers)
            .values({
              entryId: id,
              playerId: member.playerId,
              position: member.position,
            })
            
        }
      }

      const updated: EntryWithMembers = {
        ...existing,
        ...next,
        members: input.members
          ? input.members.map((m) => ({
              entryId: id,
              playerId: m.playerId,
              position: m.position,
            }))
          : existing.members,
      };
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "entry.update",
        entityType: "entry",
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });
  }

  /**
   * Hard-delete only while event is SETUP (no draw/matches in V1 schema yet).
   * Otherwise prefer withdraw.
   */
  async deleteOrWithdraw(
    actor: ActorContext,
    id: string,
  ): Promise<{ action: "deleted" | "withdrawn"; entry?: EntryWithMembers }> {
    assertCanPerform(actor.role, "import");
    const existing = await this.getById(id);
    const event = await this.events.findById(existing.eventId);
    if (!event) {
      throw new NotFoundError(`Event ${existing.eventId} not found`);
    }

    if (event.status === "SETUP") {
      this.db.transaction(async (tx) => {
        await tx.delete(entryMembers).where(eq(entryMembers.entryId, id))
        await tx.delete(entries).where(eq(entries.id, id))
        await writeAuditLog(tx, {
          userId: actor.userId,
          action: "entry.delete",
          entityType: "entry",
          entityId: id,
          before: existing,
        });
      });
      return { action: "deleted" };
    }

    const withdrawn = await this.setStatus(actor, id, "WITHDRAWN");
    return { action: "withdrawn", entry: withdrawn };
  }

  async setStatus(
    actor: ActorContext,
    id: string,
    status: Extract<EntryStatus, "WITHDRAWN" | "DISQUALIFIED" | "ACTIVE">,
  ): Promise<EntryWithMembers> {
    assertCanPerform(actor.role, "import");
    const existing = await this.getById(id);

    if (status === "ACTIVE" && existing.status !== "ACTIVE") {
      // Re-activating: re-check uniqueness constraints.
      const event = await this.events.findById(existing.eventId);
      if (!event) {
        throw new NotFoundError(`Event ${existing.eventId} not found`);
      }
      await this.assertNoDuplicateMembership(
        existing.eventId,
        existing.members.map((m) => m.playerId),
        id,
      );
      await this.assertUniqueSeed(existing.eventId, existing.seed, id);
    }

    if (
      (status === "WITHDRAWN" || status === "DISQUALIFIED") &&
      existing.status !== "ACTIVE"
    ) {
      throw new DomainStateError(
        `Cannot ${status.toLowerCase()} an entry that is ${existing.status}`,
        "ENTRY_STATUS_INVALID",
      );
    }

    return this.db.transaction(async (tx) => {
      const updatedAt = nowIso();
      await tx.update(entries)
        .set({ status, updatedAt })
        .where(eq(entries.id, id))
        
      const updated: EntryWithMembers = {
        ...existing,
        status,
        updatedAt,
      };
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: `entry.${status.toLowerCase()}`,
        entityType: "entry",
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });
  }

  async validationSummary(eventId: string): Promise<EntryValidationSummary> {
    const event = await this.events.findById(eventId);
    if (!event) {
      throw new NotFoundError(`Event ${eventId} not found`);
    }
    const list = await this.entries.listByEventId(eventId);
    const invalid: EntryValidationSummary["invalid"] = [];

    for (const entry of list) {
      if (entry.status !== "ACTIVE") {
        continue;
      }
      const errors: string[] = [];
      try {
        assertMemberCardinality(event.type, entry.members);
      } catch (err) {
        if (err instanceof ValidationError) {
          errors.push(err.message);
        }
      }
      if (errors.length > 0) {
        invalid.push({
          entryId: entry.id,
          displayName: entry.displayName,
          errors,
        });
      }
    }

    return {
      total: list.length,
      active: list.filter((e) => e.status === "ACTIVE").length,
      withdrawn: list.filter((e) => e.status === "WITHDRAWN").length,
      disqualified: list.filter((e) => e.status === "DISQUALIFIED").length,
      seeded: list.filter((e) => e.status === "ACTIVE" && e.seed != null)
        .length,
      invalid,
    };
  }
}
