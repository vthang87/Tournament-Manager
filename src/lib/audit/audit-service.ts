import type { AppDatabase } from "@/db/client";
import { auditLogs } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";

export type WriteAuditLogInput = {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
};

export type AuditDb = {
  insert: AppDatabase["insert"];
};

function toJson(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }
  return JSON.stringify(value);
}

export async function writeAuditLog(
  db: AuditDb,
  input: WriteAuditLogInput,
): Promise<{ id: string }> {
  const id = createId();
  await db.insert(auditLogs).values({
    id,
    userId: input.userId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    beforeJson: toJson(input.before),
    afterJson: toJson(input.after),
    metadataJson: toJson(input.metadata),
    createdAt: nowIso(),
  });
  return { id };
}
