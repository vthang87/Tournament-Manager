import { eq } from "drizzle-orm";
import { createDb, type AppDatabase } from "./client";
import { runMigrations } from "./migrate";
import { SEED_IDS } from "./seed-ids";
import {
  courts,
  matchRules,
  stageRules,
  stages,
  tournamentEvents,
  tournaments,
  tournamentMembers,
  users,
  sports,
} from "./schema";
import { SPORT_IDS } from "@/core/domain";
import { hashPassword } from "@/lib/auth/password";
import { nowIso } from "@/lib/id";
import { seedDemoTournament } from "./seed-demo-data";
import { seedDemoLiveSimulation } from "./seed-demo-live";

async function upsertAdmin(db: AppDatabase): Promise<void> {
  const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
  const displayName = process.env.SEED_ADMIN_DISPLAY_NAME ?? "Local Admin";
  const now = nowIso();
  const passwordHash = await hashPassword(password);

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.id, SEED_IDS.adminUser))
    .limit(1);

  if (existing[0]) {
    await db
      .update(users)
      .set({
        username,
        passwordHash,
        displayName,
        role: "SUPER_ADMIN",
        active: true,
        updatedAt: now,
      })
      .where(eq(users.id, SEED_IDS.adminUser));
    return;
  }

  await db.insert(users).values({
    id: SEED_IDS.adminUser,
    username,
    passwordHash,
    displayName,
    role: "SUPER_ADMIN",
    active: true,
    createdAt: now,
    updatedAt: now,
  });
}

async function upsertDemoUsers(db: AppDatabase): Promise<void> {
  const password =
    process.env.SEED_DEMO_PASSWORD ?? "demo1234";
  const passwordHash = await hashPassword(password);
  const now = nowIso();
  const definitions = [
    {
      id: SEED_IDS.demoUsers.admin,
      username: "demo-admin",
      displayName: "Demo Tournament Admin",
      role: "ADMIN" as const,
    },
    {
      id: SEED_IDS.demoUsers.operator,
      username: "demo-operator",
      displayName: "Demo Operator",
      role: "OPERATOR" as const,
    },
    {
      id: SEED_IDS.demoUsers.scorekeeper,
      username: "demo-scorekeeper",
      displayName: "Demo Scorekeeper",
      role: "SCOREKEEPER" as const,
    },
    {
      id: SEED_IDS.demoUsers.viewer,
      username: "demo-viewer",
      displayName: "Demo Viewer",
      role: "VIEWER" as const,
    },
  ];

  for (const definition of definitions) {
    await db
      .insert(users)
      .values({
        ...definition,
        passwordHash,
        active: true,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          username: definition.username,
          passwordHash,
          displayName: definition.displayName,
          role: definition.role,
          active: true,
          updatedAt: now,
        },
      });
  }
}

async function upsertDemoTournamentMembers(
  db: AppDatabase,
): Promise<void> {
  const now = nowIso();
  const definitions = [
    { userId: SEED_IDS.demoUsers.admin, role: "ADMIN" as const },
    { userId: SEED_IDS.demoUsers.operator, role: "OPERATOR" as const },
    {
      userId: SEED_IDS.demoUsers.scorekeeper,
      role: "SCOREKEEPER" as const,
    },
    { userId: SEED_IDS.demoUsers.viewer, role: "VIEWER" as const },
  ];

  for (const definition of definitions) {
    await db
      .insert(tournamentMembers)
      .values({
        tournamentId: SEED_IDS.tournament,
        userId: definition.userId,
        role: definition.role,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          tournamentMembers.tournamentId,
          tournamentMembers.userId,
        ],
        set: { role: definition.role, updatedAt: now },
      });
  }
}

async function upsertSports(db: AppDatabase): Promise<void> {
  const now = nowIso();
  for (const definition of [
    { id: SPORT_IDS.BADMINTON, code: "BADMINTON", name: "Badminton" },
    { id: SPORT_IDS.PICKLEBALL, code: "PICKLEBALL", name: "Pickleball" },
  ]) {
    await db
      .insert(sports)
      .values({ ...definition, active: true, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: sports.id,
        set: {
          code: definition.code,
          name: definition.name,
          active: true,
          updatedAt: now,
        },
      });
  }
}

async function upsertTournament(db: AppDatabase): Promise<void> {
  const now = nowIso();
  const existing = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, SEED_IDS.tournament))
    .limit(1);

  // Status advanced by seedDemoTournament — preserve later statuses on re-seed.
  const values = {
    id: SEED_IDS.tournament,
    ownerUserId: SEED_IDS.adminUser,
    sportId: SPORT_IDS.BADMINTON,
    name: "HCMC Badminton Open 2026",
    slug: "hcmc-badminton-open-2026",
    description:
      "Demo tournament: 32 men's doubles teams, 8 seeds, 4 courts. Ready to draw (8 groups × 4).",
    location: "Ho Chi Minh City",
    timezone: "Asia/Ho_Chi_Minh",
    startDate: "2026-08-01",
    endDate: "2026-08-03",
    updatedAt: now,
  };

  if (existing[0]) {
    await db
      .update(tournaments)
      .set(values)
      .where(eq(tournaments.id, SEED_IDS.tournament));
    return;
  }

  await db.insert(tournaments).values({
    ...values,
    status: "DRAFT",
    createdAt: now,
  });
}

async function upsertEvent(db: AppDatabase): Promise<void> {
  const now = nowIso();
  const existing = await db
    .select()
    .from(tournamentEvents)
    .where(eq(tournamentEvents.id, SEED_IDS.eventMensDoubles))
    .limit(1);

  // Status is advanced by seedDemoTournament after entries exist — do not
  // downgrade DRAW_READY+ on re-seed.
  const values = {
    id: SEED_IDS.eventMensDoubles,
    tournamentId: SEED_IDS.tournament,
    name: "Men's Doubles",
    type: "DOUBLES" as const,
    genderCategory: "MALE" as const,
    defaultMatchRuleId: SEED_IDS.ruleGroup as string | null,
    thirdPlaceMatchEnabled: true,
    updatedAt: now,
  };

  if (existing[0]) {
    await db
      .update(tournamentEvents)
      .set(values)
      .where(eq(tournamentEvents.id, SEED_IDS.eventMensDoubles));
    return;
  }

  await db.insert(tournamentEvents).values({
    ...values,
    status: "SETUP",
    defaultMatchRuleId: null,
    createdAt: now,
  });
}

async function upsertRules(db: AppDatabase): Promise<void> {
  const now = nowIso();
  const presets = [
    {
      id: SEED_IDS.ruleGroup,
      name: "Group Stage — Best of 1 (21)",
      bestOfSets: 1,
      pointsToWin: 21,
      winBy: 2,
      maxPoints: 30,
    },
    {
      id: SEED_IDS.ruleKnockout,
      name: "Knockout — Best of 3 (15)",
      bestOfSets: 3,
      pointsToWin: 15,
      winBy: 2,
      maxPoints: 21,
    },
    {
      id: SEED_IDS.ruleFinal,
      name: "Final — Best of 3 (21)",
      bestOfSets: 3,
      pointsToWin: 21,
      winBy: 2,
      maxPoints: 30,
    },
  ] as const;

  for (const preset of presets) {
    const existing = await db
      .select()
      .from(matchRules)
      .where(eq(matchRules.id, preset.id))
      .limit(1);

    const values = {
      id: preset.id,
      eventId: SEED_IDS.eventMensDoubles,
      name: preset.name,
      bestOfSets: preset.bestOfSets,
      pointsToWin: preset.pointsToWin,
      winBy: preset.winBy,
      maxPoints: preset.maxPoints,
      deuceEnabled: true,
      decidingSetPoints: null,
      decidingSetWinBy: null,
      decidingSetMaxPoints: null,
      changeEndsEnabled: true,
      changeEndsAt: 11,
      updatedAt: now,
    };

    if (existing[0]) {
      await db
        .update(matchRules)
        .set(values)
        .where(eq(matchRules.id, preset.id));
    } else {
      await db.insert(matchRules).values({
        ...values,
        createdAt: now,
      });
    }
  }

  await db
    .update(tournamentEvents)
    .set({
      defaultMatchRuleId: SEED_IDS.ruleGroup,
      updatedAt: now,
    })
    .where(eq(tournamentEvents.id, SEED_IDS.eventMensDoubles));
}

async function upsertCourts(db: AppDatabase): Promise<void> {
  const now = nowIso();
  /** Demo referee PIN for court kiosk scoring (`/r/{slug}/c/{code}`). */
  const demoPinHash = await hashPassword("1234");
  const courtDefs = [
    { id: SEED_IDS.courts[0], name: "Court 1", code: "C1" },
    { id: SEED_IDS.courts[1], name: "Court 2", code: "C2" },
    { id: SEED_IDS.courts[2], name: "Court 3", code: "C3" },
    { id: SEED_IDS.courts[3], name: "Court 4", code: "C4" },
  ] as const;

  for (const court of courtDefs) {
    const existing = await db
      .select()
      .from(courts)
      .where(eq(courts.id, court.id))
      .limit(1);

    const values = {
      id: court.id,
      tournamentId: SEED_IDS.tournament,
      name: court.name,
      code: court.code,
      active: true,
      accessPinHash: demoPinHash,
      updatedAt: now,
    };

    if (existing[0]) {
      await db.update(courts).set(values).where(eq(courts.id, court.id));
    } else {
      await db.insert(courts).values({
        ...values,
        createdAt: now,
      });
    }
  }
}

async function upsertStages(db: AppDatabase): Promise<void> {
  const now = nowIso();
  const stageDefs = [
    {
      id: SEED_IDS.stageGroup,
      type: "GROUP",
      name: "Group Stage",
      orderIndex: 0,
      format: "GROUP" as const,
      matchRuleId: SEED_IDS.ruleGroup,
    },
    {
      id: SEED_IDS.stageKnockout,
      type: "KNOCKOUT",
      name: "Knockout",
      orderIndex: 1,
      format: "KNOCKOUT" as const,
      matchRuleId: SEED_IDS.ruleKnockout,
    },
  ] as const;

  for (const def of stageDefs) {
    const existing = await db
      .select()
      .from(stages)
      .where(eq(stages.id, def.id))
      .limit(1);

    const values = {
      id: def.id,
      eventId: SEED_IDS.eventMensDoubles,
      type: def.type,
      name: def.name,
      orderIndex: def.orderIndex,
      format: def.format,
      status: "PENDING" as const,
      updatedAt: now,
    };

    if (existing[0]) {
      await db.update(stages).set(values).where(eq(stages.id, def.id));
    } else {
      await db.insert(stages).values({
        ...values,
        createdAt: now,
      });
    }

    await db.delete(stageRules).where(eq(stageRules.stageId, def.id));
    await db.insert(stageRules).values({
      stageId: def.id,
      matchRuleId: def.matchRuleId,
    });
  }
}

export async function seedDatabase(connectionString?: string): Promise<void> {
  await runMigrations(connectionString);
  const { db, pool } = createDb(connectionString);

  try {
    await upsertAdmin(db);
    await upsertDemoUsers(db);
    await upsertSports(db);
    await upsertTournament(db);
    await upsertDemoTournamentMembers(db);
    await upsertEvent(db);
    await upsertRules(db);
    await upsertCourts(db);
    await upsertStages(db);
    await seedDemoTournament(db);
    await seedDemoLiveSimulation(db);
  } finally {
    await pool.end();
  }
}
