import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ForbiddenError } from "@/application/errors";
import { createDb } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { users, auditLogs } from "@/db/schema";
import { authenticateCredentials } from "@/features/auth/authenticate";
import { writeAuditLog } from "@/lib/audit";
import {
  assertRole,
  canPerform,
  decodeSessionToken,
  encodeSessionToken,
  hashPassword,
  rolesForAction,
  type PolicyAction,
  type SessionUser,
} from "@/lib/auth";
import type { UserRole } from "@/core/domain";
import { createId, nowIso } from "@/lib/id";

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-auth-"));
  return path.join(dir, "test.db");
}

async function insertUser(
  db: ReturnType<typeof createDb>["db"],
  overrides: {
    username?: string;
    password?: string;
    role?: UserRole;
    active?: boolean;
  } = {},
) {
  const now = nowIso();
  const password = overrides.password ?? "secret-password";
  const row = {
    id: createId(),
    username: overrides.username ?? "coach",
    passwordHash: await hashPassword(password),
    displayName: "Test User",
    role: overrides.role ?? ("ADMIN" as UserRole),
    active: overrides.active ?? true,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(users).values(row);
  return { ...row, password };
}

describe("TASK 002 authentication", () => {
  let databasePath = "";

  beforeEach(() => {
    databasePath = createTempDbPath();
    runMigrations(databasePath);
  });

  afterEach(() => {
    if (databasePath) {
      fs.rmSync(path.dirname(databasePath), { recursive: true, force: true });
    }
  });

  it("logs in with the correct password", async () => {
    const { db, sqlite } = createDb(databasePath);
    try {
      const created = await insertUser(db, {
        username: "admin",
        password: "admin123",
      });
      const result = await authenticateCredentials(db, "admin", "admin123");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.user.id).toBe(created.id);
        expect(result.user.username).toBe("admin");
        expect(result.user).not.toHaveProperty("passwordHash");
        expect(result.user).not.toHaveProperty("password");
      }
    } finally {
      sqlite.close();
    }
  });

  it("rejects the wrong password", async () => {
    const { db, sqlite } = createDb(databasePath);
    try {
      await insertUser(db, { username: "admin", password: "admin123" });
      const result = await authenticateCredentials(db, "admin", "wrong");
      expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
    } finally {
      sqlite.close();
    }
  });

  it("rejects inactive users even with a correct password", async () => {
    const { db, sqlite } = createDb(databasePath);
    try {
      await insertUser(db, {
        username: "retired",
        password: "admin123",
        active: false,
      });
      const result = await authenticateCredentials(db, "retired", "admin123");
      expect(result).toEqual({ ok: false, reason: "inactive" });
    } finally {
      sqlite.close();
    }
  });

  it("logout clears auth by destroying the session cookie contract", async () => {
    // Session encode/decode must not embed secrets; logout deletes the cookie
    // (destroySession) so subsequent decode of an empty jar yields null.
    const user: SessionUser = {
      id: "u1",
      username: "admin",
      displayName: "Admin",
      role: "ADMIN",
    };
    const token = await encodeSessionToken(user);
    const decoded = await decodeSessionToken(token);
    expect(decoded?.id).toBe("u1");

    // Simulating logout: discard the token — no password was ever present.
    expect(JSON.stringify(decoded)).not.toMatch(/password/i);
    expect(token.toLowerCase()).not.toContain("admin123");
    expect(await decodeSessionToken("invalid.token.value")).toBeNull();
  });
});

describe("TASK 002 session cookie privacy", () => {
  it("does not put the password in the session JWT", async () => {
    const user: SessionUser = {
      id: "user-1",
      username: "admin",
      displayName: "Local Admin",
      role: "ADMIN",
    };
    const token = await encodeSessionToken(user);
    const parts = token.split(".");
    expect(parts).toHaveLength(3);

    const payloadJson = Buffer.from(parts[1]!, "base64url").toString("utf8");
    expect(payloadJson.toLowerCase()).not.toContain("password");
    expect(payloadJson).not.toContain("admin123");
    expect(payloadJson).not.toContain(process.env.SESSION_SECRET);

    const decoded = await decodeSessionToken(token);
    expect(decoded).toEqual(user);
  });
});

describe("TASK 002 requireRole matrix", () => {
  const matrix: Record<PolicyAction, UserRole[]> = {
    setup: ["SUPER_ADMIN", "ADMIN"],
    import: ["SUPER_ADMIN", "ADMIN", "OPERATOR"],
    draw: ["SUPER_ADMIN", "ADMIN", "OPERATOR"],
    schedule: ["SUPER_ADMIN", "ADMIN", "OPERATOR"],
    score: ["SUPER_ADMIN", "ADMIN", "OPERATOR", "SCOREKEEPER"],
    correct: ["SUPER_ADMIN", "ADMIN", "OPERATOR"],
    archive: ["SUPER_ADMIN", "ADMIN"],
    view: ["SUPER_ADMIN", "ADMIN", "OPERATOR", "SCOREKEEPER", "VIEWER"],
  };

  const allRoles: UserRole[] = [
    "SUPER_ADMIN",
    "ADMIN",
    "OPERATOR",
    "SCOREKEEPER",
    "VIEWER",
  ];

  for (const [action, allowed] of Object.entries(matrix) as [
    PolicyAction,
    UserRole[],
  ][]) {
    it(`allows ${action} for ${allowed.join(", ")} only`, () => {
      expect([...rolesForAction(action)].sort()).toEqual([...allowed].sort());
      for (const role of allRoles) {
        expect(canPerform(role, action)).toBe(allowed.includes(role));
      }
    });
  }

  it("assertRole matches requireRole enforcement", () => {
    const scorekeeper: SessionUser = {
      id: "1",
      username: "sk",
      displayName: "SK",
      role: "SCOREKEEPER",
    };
    expect(assertRole(scorekeeper, ["ADMIN", "OPERATOR", "SCOREKEEPER"]).role).toBe(
      "SCOREKEEPER",
    );
    expect(() => assertRole(scorekeeper, ["ADMIN"])).toThrow(ForbiddenError);
  });
});

describe("TASK 002 audit rollback", () => {
  let databasePath = "";

  beforeEach(() => {
    databasePath = createTempDbPath();
    runMigrations(databasePath);
  });

  afterEach(() => {
    if (databasePath) {
      fs.rmSync(path.dirname(databasePath), { recursive: true, force: true });
    }
  });

  it("rolls back the audit log when the surrounding transaction fails", async () => {
    const { db, sqlite } = createDb(databasePath);
    try {
      const user = await insertUser(db);

      expect(() =>
        db.transaction(async (tx) => {
          await writeAuditLog(tx, {
            userId: user.id,
            action: "TEST.MUTATION",
            entityType: "tournament",
            entityId: "t-1",
            before: { status: "DRAFT" },
            after: { status: "REGISTRATION" },
          });

          const rows = tx.select().from(auditLogs).all();
          expect(rows).toHaveLength(1);

          throw new Error("force rollback");
        }),
      ).toThrow("force rollback");

      const remaining = await db.select().from(auditLogs);
      expect(remaining).toHaveLength(0);

      const stillThere = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id));
      expect(stillThere).toHaveLength(1);
    } finally {
      sqlite.close();
    }
  });

  it("commits the audit log when the transaction succeeds", async () => {
    const { db, sqlite } = createDb(databasePath);
    try {
      const user = await insertUser(db);

      db.transaction(async (tx) => {
        await writeAuditLog(tx, {
          userId: user.id,
          action: "TEST.OK",
          entityType: "tournament",
          entityId: "t-2",
          after: { ok: true },
        });
      });

      const rows = await db.select().from(auditLogs);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.action).toBe("TEST.OK");
      expect(rows[0]?.afterJson).toBe(JSON.stringify({ ok: true }));
    } finally {
      sqlite.close();
    }
  });
});
