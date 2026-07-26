import { asc, eq, ilike, or } from "drizzle-orm";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/application/errors";
import type { ActorContext, UserRole } from "@/core/domain";
import type { AppDatabase } from "@/db/client";
import { users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { createId, nowIso } from "@/lib/id";
import {
  createManagedUserSchema,
  parseOrThrow,
  resetManagedUserPasswordSchema,
  updateManagedUserSchema,
} from "@/lib/validation/schemas";

export type ManagedUserView = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

function toView(row: typeof users.$inferSelect): ManagedUserView {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role as UserRole,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class UserManagementService {
  constructor(private readonly db: AppDatabase) {}

  private assertSuperAdmin(actor: ActorContext): asserts actor is ActorContext & {
    userId: string;
    role: "SUPER_ADMIN";
  } {
    if (!actor.userId || actor.role !== "SUPER_ADMIN") {
      throw new ForbiddenError("Super Admin access is required");
    }
  }

  async list(actor: ActorContext, query?: string): Promise<ManagedUserView[]> {
    this.assertSuperAdmin(actor);
    const term = query?.trim();
    const rows = term
      ? await this.db
          .select()
          .from(users)
          .where(
            or(
              ilike(users.username, `%${term}%`),
              ilike(users.displayName, `%${term}%`),
            ),
          )
          .orderBy(asc(users.username))
      : await this.db.select().from(users).orderBy(asc(users.username));
    return rows.map(toView);
  }

  async getById(actor: ActorContext, id: string): Promise<ManagedUserView> {
    this.assertSuperAdmin(actor);
    const row = await this.findRow(id);
    return toView(row);
  }

  async create(
    actor: ActorContext,
    raw: unknown,
  ): Promise<ManagedUserView> {
    this.assertSuperAdmin(actor);
    const input = parseOrThrow(createManagedUserSchema, raw);
    const existing = await this.findByUsername(input.username);
    if (existing) {
      throw new ConflictError(`Username "${input.username}" is already in use`);
    }

    const now = nowIso();
    const row = {
      id: createId(),
      username: input.username,
      displayName: input.displayName,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.transaction(async (tx) => {
      await tx.insert(users).values(row);
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "user.create",
        entityType: "user",
        entityId: row.id,
        after: toView(row),
      });
    });
    return toView(row);
  }

  async update(
    actor: ActorContext,
    id: string,
    raw: unknown,
  ): Promise<ManagedUserView> {
    this.assertSuperAdmin(actor);
    const input = parseOrThrow(updateManagedUserSchema, raw);
    const existing = await this.findRow(id);

    if (
      id === actor.userId &&
      (input.role !== "SUPER_ADMIN" || !input.active)
    ) {
      throw new ConflictError(
        "You cannot deactivate or remove Super Admin access from your own account",
      );
    }
    if (
      existing.role === "SUPER_ADMIN" &&
      existing.active &&
      (input.role !== "SUPER_ADMIN" || !input.active)
    ) {
      await this.assertAnotherActiveSuperAdmin(id);
    }
    if (input.username !== existing.username) {
      const clash = await this.findByUsername(input.username);
      if (clash) {
        throw new ConflictError(
          `Username "${input.username}" is already in use`,
        );
      }
    }

    const next = {
      username: input.username,
      displayName: input.displayName,
      role: input.role,
      active: input.active,
      updatedAt: nowIso(),
    };
    await this.db.transaction(async (tx) => {
      await tx.update(users).set(next).where(eq(users.id, id));
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "user.update",
        entityType: "user",
        entityId: id,
        before: toView(existing),
        after: toView({ ...existing, ...next }),
      });
    });
    return toView({ ...existing, ...next });
  }

  async resetPassword(
    actor: ActorContext,
    id: string,
    raw: unknown,
  ): Promise<void> {
    this.assertSuperAdmin(actor);
    const input = parseOrThrow(resetManagedUserPasswordSchema, raw);
    const existing = await this.findRow(id);
    const updatedAt = nowIso();
    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          passwordHash: await hashPassword(input.password),
          updatedAt,
        })
        .where(eq(users.id, id));
      await writeAuditLog(tx, {
        userId: actor.userId,
        action: "user.password_reset",
        entityType: "user",
        entityId: id,
        metadata: { username: existing.username },
      });
    });
  }

  private async findRow(id: string): Promise<typeof users.$inferSelect> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!row) {
      throw new NotFoundError(`User ${id} not found`);
    }
    return row;
  }

  private async findByUsername(
    username: string,
  ): Promise<typeof users.$inferSelect | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return row ?? null;
  }

  private async assertAnotherActiveSuperAdmin(userId: string): Promise<void> {
    const activeSuperAdmins = await this.db
      .select({ id: users.id, active: users.active })
      .from(users)
      .where(eq(users.role, "SUPER_ADMIN"));
    const otherActiveCount = activeSuperAdmins.filter(
      (user) => user.id !== userId && user.active,
    ).length;
    if (otherActiveCount === 0) {
      throw new ConflictError(
        "At least one active Super Admin account must remain",
      );
    }
  }
}
