import { eq, and } from "drizzle-orm";
import { ForbiddenError, NotFoundError } from "@/application/errors";
import type {
  ActorContext,
  Tournament,
  TournamentMemberRole,
} from "@/core/domain";
import type { AppDatabase } from "@/db/client";
import {
  courts,
  drawSessions,
  entries,
  matches,
  matchRules,
  stages,
  tournamentEvents,
  tournamentMembers,
  tournaments,
} from "@/db/schema";
import {
  assertCanPerform,
  type PolicyAction,
} from "@/lib/auth/policies";

export type TournamentAccess = {
  tournament: Tournament;
  role: TournamentMemberRole;
  isOwner: boolean;
};

function mapTournament(
  row: typeof tournaments.$inferSelect,
): Tournament {
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
    status: row.status as Tournament["status"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class TournamentAccessService {
  constructor(private readonly db: AppDatabase) {}

  async resolve(
    actor: ActorContext,
    tournamentId: string,
  ): Promise<TournamentAccess> {
    if (!actor.userId) {
      throw new ForbiddenError("Authenticated user is required");
    }
    const [row] = await this.db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .limit(1);
    if (!row) {
      throw new NotFoundError(`Tournament ${tournamentId} not found`);
    }
    if (row.ownerUserId === actor.userId) {
      return {
        tournament: mapTournament(row),
        role: "ADMIN",
        isOwner: true,
      };
    }
    const [membership] = await this.db
      .select()
      .from(tournamentMembers)
      .where(
        and(
          eq(tournamentMembers.tournamentId, tournamentId),
          eq(tournamentMembers.userId, actor.userId),
        ),
      )
      .limit(1);
    if (!membership) {
      throw new NotFoundError(`Tournament ${tournamentId} not found`);
    }
    return {
      tournament: mapTournament(row),
      role: membership.role as TournamentMemberRole,
      isOwner: false,
    };
  }

  async assert(
    actor: ActorContext,
    tournamentId: string,
    action: PolicyAction,
  ): Promise<TournamentAccess> {
    const access = await this.resolve(actor, tournamentId);
    assertCanPerform(access.role, action);
    return access;
  }

  async assertForEvent(
    actor: ActorContext,
    eventId: string,
    action: PolicyAction,
  ) {
    const [row] = await this.db
      .select({ tournamentId: tournamentEvents.tournamentId })
      .from(tournamentEvents)
      .where(eq(tournamentEvents.id, eventId))
      .limit(1);
    if (!row) {
      throw new NotFoundError(`Event ${eventId} not found`);
    }
    return this.assert(actor, row.tournamentId, action);
  }

  async assertForStage(
    actor: ActorContext,
    stageId: string,
    action: PolicyAction,
  ) {
    const [row] = await this.db
      .select({ eventId: stages.eventId })
      .from(stages)
      .where(eq(stages.id, stageId))
      .limit(1);
    if (!row) {
      throw new NotFoundError(`Stage ${stageId} not found`);
    }
    return this.assertForEvent(actor, row.eventId, action);
  }

  async assertForMatch(
    actor: ActorContext,
    matchId: string,
    action: PolicyAction,
  ) {
    const [row] = await this.db
      .select({ eventId: matches.eventId })
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);
    if (!row) {
      throw new NotFoundError(`Match ${matchId} not found`);
    }
    return this.assertForEvent(actor, row.eventId, action);
  }

  async assertForCourt(
    actor: ActorContext,
    courtId: string,
    action: PolicyAction,
  ) {
    const [row] = await this.db
      .select({ tournamentId: courts.tournamentId })
      .from(courts)
      .where(eq(courts.id, courtId))
      .limit(1);
    if (!row) {
      throw new NotFoundError(`Court ${courtId} not found`);
    }
    return this.assert(actor, row.tournamentId, action);
  }

  async assertForEntry(
    actor: ActorContext,
    entryId: string,
    action: PolicyAction,
  ) {
    const [row] = await this.db
      .select({ eventId: entries.eventId })
      .from(entries)
      .where(eq(entries.id, entryId))
      .limit(1);
    if (!row) {
      throw new NotFoundError(`Entry ${entryId} not found`);
    }
    return this.assertForEvent(actor, row.eventId, action);
  }

  async assertForRule(
    actor: ActorContext,
    ruleId: string,
    action: PolicyAction,
  ) {
    const [row] = await this.db
      .select({ eventId: matchRules.eventId })
      .from(matchRules)
      .where(eq(matchRules.id, ruleId))
      .limit(1);
    if (!row) {
      throw new NotFoundError(`Match rule ${ruleId} not found`);
    }
    return this.assertForEvent(actor, row.eventId, action);
  }

  async assertForDrawSession(
    actor: ActorContext,
    drawSessionId: string,
    action: PolicyAction,
  ) {
    const [row] = await this.db
      .select({ eventId: drawSessions.eventId })
      .from(drawSessions)
      .where(eq(drawSessions.id, drawSessionId))
      .limit(1);
    if (!row) {
      throw new NotFoundError(`Draw session ${drawSessionId} not found`);
    }
    return this.assertForEvent(actor, row.eventId, action);
  }
}
