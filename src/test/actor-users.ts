import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import type { ActorContext, UserRole } from "@/core/domain";
import { users } from "@/db/schema";
import { nowIso } from "@/lib/id";

export async function ensureActorUser(
  db: AppDatabase,
  actor: ActorContext,
  username?: string,
): Promise<void> {
  if (!actor.userId) {
    return;
  }
  const userId = actor.userId;
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (existing[0]) {
    return;
  }
  const now = nowIso();
  await db.insert(users).values({
    id: userId,
    username: username ?? `${actor.role.toLowerCase()}-${userId}`,
    passwordHash: "test-hash",
    displayName: actor.role,
    role: actor.role as UserRole,
    active: true,
    createdAt: now,
    updatedAt: now,
  });
}

export async function ensureActors(
  db: AppDatabase,
  actors: ActorContext[],
): Promise<void> {
  for (const actor of actors) {
    await ensureActorUser(db, actor);
  }
}
