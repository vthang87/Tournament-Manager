import { and, eq } from "drizzle-orm";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/application/errors";
import type {
  ActorContext,
  TournamentMemberRole,
} from "@/core/domain";
import type { AppDatabase } from "@/db/client";
import { tournamentMembers, users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { nowIso } from "@/lib/id";
import { TournamentAccessService } from "./tournament-access-service";

export type TournamentMemberView = {
  tournamentId: string;
  userId: string;
  username: string;
  displayName: string;
  role: TournamentMemberRole;
  createdAt: string;
  updatedAt: string;
};

export class TournamentMemberService {
  private readonly access: TournamentAccessService;

  constructor(private readonly db: AppDatabase) {
    this.access = new TournamentAccessService(db);
  }

  private async assertOwner(actor: ActorContext, tournamentId: string) {
    const access = await this.access.resolve(actor, tournamentId);
    if (!access.isOwner) {
      throw new ForbiddenError("Only the tournament owner can manage members");
    }
    return access;
  }

  async list(
    actor: ActorContext,
    tournamentId: string,
  ): Promise<TournamentMemberView[]> {
    await this.assertOwner(actor, tournamentId);
    const rows = await this.db
      .select({
        tournamentId: tournamentMembers.tournamentId,
        userId: tournamentMembers.userId,
        username: users.username,
        displayName: users.displayName,
        role: tournamentMembers.role,
        createdAt: tournamentMembers.createdAt,
        updatedAt: tournamentMembers.updatedAt,
      })
      .from(tournamentMembers)
      .innerJoin(users, eq(users.id, tournamentMembers.userId))
      .where(eq(tournamentMembers.tournamentId, tournamentId));
    return rows as TournamentMemberView[];
  }

  async addByUsername(
    actor: ActorContext,
    tournamentId: string,
    username: string,
    role: TournamentMemberRole,
  ): Promise<void> {
    const access = await this.assertOwner(actor, tournamentId);
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username.trim()))
      .limit(1);
    if (!user?.active) {
      throw new NotFoundError(`Active user "${username}" not found`);
    }
    if (user.id === access.tournament.ownerUserId) {
      throw new ConflictError("Tournament owner is already an administrator");
    }
    const now = nowIso();
    await this.db.transaction(async (tx) => {
      await tx
        .insert(tournamentMembers)
        .values({
          tournamentId,
          userId: user.id,
          role,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            tournamentMembers.tournamentId,
            tournamentMembers.userId,
          ],
          set: { role, updatedAt: now },
        });
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "tournament_member.upsert",
        entityType: "tournament_member",
        entityId: `${tournamentId}:${user.id}`,
        after: { tournamentId, memberUserId: user.id, role },
      });
    });
  }

  async updateRole(
    actor: ActorContext,
    tournamentId: string,
    userId: string,
    role: TournamentMemberRole,
  ): Promise<void> {
    await this.assertOwner(actor, tournamentId);
    const result = await this.db
      .update(tournamentMembers)
      .set({ role, updatedAt: nowIso() })
      .where(
        and(
          eq(tournamentMembers.tournamentId, tournamentId),
          eq(tournamentMembers.userId, userId),
        ),
      );
    if ((result.rowCount ?? 0) === 0) {
      throw new NotFoundError("Tournament member not found");
    }
  }

  async remove(
    actor: ActorContext,
    tournamentId: string,
    userId: string,
  ): Promise<void> {
    await this.assertOwner(actor, tournamentId);
    await this.db
      .delete(tournamentMembers)
      .where(
        and(
          eq(tournamentMembers.tournamentId, tournamentId),
          eq(tournamentMembers.userId, userId),
        ),
      );
  }
}
