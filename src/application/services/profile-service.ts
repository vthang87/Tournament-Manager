import { eq } from "drizzle-orm";
import {
  NotFoundError,
  ValidationError,
} from "@/application/errors";
import type { ActorContext, UserRole } from "@/core/domain";
import type { AppDatabase } from "@/db/client";
import { users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { nowIso } from "@/lib/id";
import {
  changeOwnPasswordSchema,
  parseOrThrow,
  updateOwnProfileSchema,
} from "@/lib/validation/schemas";

export type ProfileView = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
};

export class ProfileService {
  constructor(private readonly db: AppDatabase) {}

  async get(actor: ActorContext): Promise<ProfileView> {
    const user = await this.findActor(actor);
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role as UserRole,
    };
  }

  async update(
    actor: ActorContext,
    raw: unknown,
  ): Promise<ProfileView> {
    const input = parseOrThrow(updateOwnProfileSchema, raw);
    const existing = await this.findActor(actor);
    const updatedAt = nowIso();

    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ displayName: input.displayName, updatedAt })
        .where(eq(users.id, existing.id));
      await writeAuditLog(tx, {
        userId: existing.id,
        action: "profile.update",
        entityType: "user",
        entityId: existing.id,
        before: { displayName: existing.displayName },
        after: { displayName: input.displayName },
      });
    });

    return {
      id: existing.id,
      username: existing.username,
      displayName: input.displayName,
      role: existing.role as UserRole,
    };
  }

  async changePassword(
    actor: ActorContext,
    raw: unknown,
  ): Promise<void> {
    const input = parseOrThrow(changeOwnPasswordSchema, raw);
    const existing = await this.findActor(actor);
    if (
      !(await verifyPassword(
        existing.passwordHash,
        input.currentPassword,
      ))
    ) {
      throw new ValidationError("Current password is incorrect");
    }
    if (
      await verifyPassword(existing.passwordHash, input.newPassword)
    ) {
      throw new ValidationError(
        "New password must be different from the current password",
      );
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          passwordHash: await hashPassword(input.newPassword),
          updatedAt: nowIso(),
        })
        .where(eq(users.id, existing.id));
      await writeAuditLog(tx, {
        userId: existing.id,
        action: "profile.password_change",
        entityType: "user",
        entityId: existing.id,
      });
    });
  }

  private async findActor(actor: ActorContext) {
    if (!actor.userId) {
      throw new NotFoundError("Authenticated user not found");
    }
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, actor.userId))
      .limit(1);
    if (!user?.active) {
      throw new NotFoundError("Authenticated user not found");
    }
    return user;
  }
}
