import { eq } from "drizzle-orm";
import type { User, UserRole } from "@/core/domain";
import type { UserRepository } from "@/application/ports/user-repository";
import type { AppDatabase } from "@/db/client";
import { users } from "@/db/schema";

function mapUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    displayName: row.displayName,
    role: row.role as UserRole,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: AppDatabase) {}

  async findById(id: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return rows[0] ? mapUser(rows[0]) : null;
  }
}
