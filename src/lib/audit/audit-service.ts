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

/**
 * DB handle or transaction client that can insert into audit_logs.
 * better-sqlite3 is sync; prefer `.run()` so audit participates in tx rollback.
 */
export type AuditDb = {
  insert: AppDatabase["insert"];
};

function toJson(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }
  return JSON.stringify(value);
}

/**
 * Writes an audit log row using the provided db handle.
 * Pass a transaction client so the audit rolls back with the mutation.
 * Synchronous to match better-sqlite3 transaction semantics.
 */
export function writeAuditLog(
  db: AuditDb,
  input: WriteAuditLogInput,
): { id: string } {
  const id = createId();
  db.insert(auditLogs)
    .values({
      id,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeJson: toJson(input.before),
      afterJson: toJson(input.after),
      metadataJson: toJson(input.metadata),
      createdAt: nowIso(),
    })
    .run();
  return { id };
}
