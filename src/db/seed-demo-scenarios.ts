/**
 * Six complete demo scenarios:
 * - badminton + pickleball
 * - draw-ready + knockout-live + completed
 *
 * The fixture is idempotent and owns only IDs prefixed with `seed-scenario-`.
 */

import { and, asc, eq, inArray } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import {
  SPORT_IDS,
  type ActorContext,
  type MatchRecord,
  type MatchWithSets,
} from "@/core/domain";
import type { MatchRuleSnapshot } from "@/core/tournament-engine/match-rules";
import {
  BracketService,
  DrawService,
  MatchGenerationService,
  StageService,
  createMatchOpsService,
} from "@/application/services";
import type { AppDatabase } from "./client";
import { createDb } from "./client";
import { runMigrations } from "./migrate";
import {
  clubs,
  courts,
  entries,
  entryMembers,
  matchRules,
  matches,
  players,
  playerSports,
  stageRules,
  stages,
  tournamentEvents,
  tournaments,
  users,
} from "./schema";
import { hashPassword } from "@/lib/auth/password";
import { nowIso } from "@/lib/id";

export type DemoSport = "badminton" | "pickleball";
export type DemoScenarioState = "draw-ready" | "knockout-live" | "completed";

type RuleDefinition = {
  name: string;
  bestOfSets: number;
  pointsToWin: number;
  winBy: number;
  maxPoints: number;
  changeEndsAt: number;
};

export type DemoScenarioDefinition = {
  sport: DemoSport;
  state: DemoScenarioState;
  prefix: string;
  name: string;
  slug: string;
  location: string;
  startDate: string;
  endDate: string;
};

type ScenarioIds = {
  tournament: string;
  event: string;
  ruleGroup: string;
  ruleKnockout: string;
  ruleMedal: string;
  stageGroup: string;
  stageKnockout: string;
  courts: [string, string, string, string];
};

type ScenarioContext = {
  definition: DemoScenarioDefinition;
  ids: ScenarioIds;
};

type ScenarioSummary = {
  name: string;
  slug: string;
  tournamentStatus: string;
  eventStatus: string;
  entries: number;
  groupMatches: number;
  knockoutMatches: number;
  statuses: Record<string, number>;
  resolutions: Record<string, number>;
  calledToCourt: number;
  champion: string | null;
  runnerUp: string | null;
  thirdPlace: string | null;
};

const ADMIN_ID = "seed-user-admin";
const TIMEZONE = "Asia/Ho_Chi_Minh";
const COURT_PIN = "1234";
const DRAW_SEED_SUFFIX = "serpentine-v1";
const GROUP_MATCH_MINUTES = 35;
const KNOCKOUT_MATCH_MINUTES = 50;

const admin: ActorContext = {
  userId: ADMIN_ID,
  role: "ADMIN",
};

const BADMINTON_GROUP_RULE: RuleDefinition = {
  name: "Cầu lông — Vòng bảng BO1 × 21",
  bestOfSets: 1,
  pointsToWin: 21,
  winBy: 2,
  maxPoints: 30,
  changeEndsAt: 11,
};

const BADMINTON_KNOCKOUT_RULE: RuleDefinition = {
  name: "Cầu lông — Knockout BO3 × 15",
  bestOfSets: 3,
  pointsToWin: 15,
  winBy: 2,
  maxPoints: 21,
  changeEndsAt: 8,
};

const BADMINTON_MEDAL_RULE: RuleDefinition = {
  name: "Cầu lông — Trận huy chương BO3 × 21",
  bestOfSets: 3,
  pointsToWin: 21,
  winBy: 2,
  maxPoints: 30,
  changeEndsAt: 11,
};

const PICKLEBALL_GROUP_RULE: RuleDefinition = {
  name: "Pickleball — Vòng bảng 1 game × 15",
  bestOfSets: 1,
  pointsToWin: 15,
  winBy: 2,
  maxPoints: 99,
  changeEndsAt: 8,
};

const PICKLEBALL_KNOCKOUT_RULE: RuleDefinition = {
  name: "Pickleball — Playoff 1 game × 15",
  bestOfSets: 1,
  pointsToWin: 15,
  winBy: 2,
  maxPoints: 99,
  changeEndsAt: 8,
};

const PICKLEBALL_MEDAL_RULE: RuleDefinition = {
  name: "Pickleball — Trận huy chương BO3 × 11",
  bestOfSets: 3,
  pointsToWin: 11,
  winBy: 2,
  maxPoints: 99,
  changeEndsAt: 6,
};

const BADMINTON_CLUBS = [
  ["Sài Gòn Smashers", "SGS"],
  ["Thủ Đức Ace", "TDA"],
  ["Bình Thạnh Shuttle", "BTS"],
  ["Quận 7 Lightning", "Q7L"],
  ["Phú Nhuận Netters", "PNN"],
  ["Gò Vấp Smash", "GVS"],
  ["Tân Bình Flight", "TBF"],
  ["District 1 Dynamos", "D1D"],
  ["Cần Giờ Coast", "CGC"],
  ["Bình Dương Blaze", "BDB"],
  ["Đồng Nai Drive", "DND"],
  ["Vũng Tàu Volt", "VTV"],
] as const;

const PICKLEBALL_CLUBS = [
  ["Sài Gòn Dinkers", "SGD"],
  ["Thủ Đức Paddles", "TDP"],
  ["Bình Thạnh Kitchen", "BTK"],
  ["Quận 7 Picklers", "Q7P"],
  ["Phú Nhuận Rally", "PNR"],
  ["Gò Vấp Spin", "GVS-P"],
  ["Tân Bình Drops", "TBD"],
  ["Quận 1 Stacks", "Q1S"],
  ["Cần Giờ Paddlers", "CGP"],
  ["Bình Dương Dinks", "BDD"],
  ["Đồng Nai Rally", "DNR"],
  ["Vũng Tàu Kitchen", "VTK"],
] as const;

const FIRST_NAMES = [
  "Minh",
  "Hoàng",
  "Khoa",
  "Đức",
  "Phúc",
  "Huy",
  "Long",
  "Nam",
  "Quân",
  "Tuấn",
  "Việt",
  "Anh",
  "Bảo",
  "Cường",
  "Dũng",
  "Hải",
  "Khải",
  "Lâm",
  "Phong",
  "Quang",
  "Sơn",
  "Thành",
  "Trí",
  "Vinh",
  "Xuân",
  "Yên",
  "Đạt",
  "Hùng",
  "Kiên",
  "Nhân",
  "Phát",
  "Tài",
] as const;

const LAST_NAMES = [
  "Nguyễn",
  "Trần",
  "Lê",
  "Phạm",
  "Hoàng",
  "Huỳnh",
  "Phan",
  "Vũ",
  "Võ",
  "Đặng",
  "Bùi",
  "Đỗ",
  "Hồ",
  "Ngô",
  "Dương",
  "Lý",
] as const;

export const DEMO_SCENARIOS: DemoScenarioDefinition[] = [
  {
    sport: "badminton",
    state: "draw-ready",
    prefix: "seed-scenario-badminton-draw-ready",
    name: "Badminton Demo Cup — Chờ bốc thăm",
    slug: "badminton-demo-draw-ready",
    location: "Nhà thi đấu Phú Thọ, TP.HCM",
    startDate: "2026-09-05",
    endDate: "2026-09-07",
  },
  {
    sport: "badminton",
    state: "knockout-live",
    prefix: "seed-scenario-badminton-knockout-live",
    name: "Badminton Demo Cup — Knockout Live",
    slug: "badminton-demo-knockout-live",
    location: "Nhà thi đấu Phú Thọ, TP.HCM",
    startDate: "2026-08-15",
    endDate: "2026-08-17",
  },
  {
    sport: "badminton",
    state: "completed",
    prefix: "seed-scenario-badminton-completed",
    name: "Badminton Demo Cup — Hoàn tất",
    slug: "badminton-demo-completed",
    location: "Nhà thi đấu Phú Thọ, TP.HCM",
    startDate: "2026-07-04",
    endDate: "2026-07-06",
  },
  {
    sport: "pickleball",
    state: "draw-ready",
    prefix: "seed-scenario-pickleball-draw-ready",
    name: "Pickleball Demo Cup — Chờ bốc thăm",
    slug: "pickleball-demo-draw-ready",
    location: "Cụm sân Pickleball Thảo Điền, TP.HCM",
    startDate: "2026-09-12",
    endDate: "2026-09-14",
  },
  {
    sport: "pickleball",
    state: "knockout-live",
    prefix: "seed-scenario-pickleball-knockout-live",
    name: "Pickleball Demo Cup — Knockout Live",
    slug: "pickleball-demo-knockout-live",
    location: "Cụm sân Pickleball Thảo Điền, TP.HCM",
    startDate: "2026-08-22",
    endDate: "2026-08-24",
  },
  {
    sport: "pickleball",
    state: "completed",
    prefix: "seed-scenario-pickleball-completed",
    name: "Pickleball Demo Cup — Hoàn tất",
    slug: "pickleball-demo-completed",
    location: "Cụm sân Pickleball Thảo Điền, TP.HCM",
    startDate: "2026-07-11",
    endDate: "2026-07-13",
  },
];

function idsFor(prefix: string): ScenarioIds {
  return {
    tournament: `${prefix}-tournament`,
    event: `${prefix}-event`,
    ruleGroup: `${prefix}-rule-group`,
    ruleKnockout: `${prefix}-rule-knockout`,
    ruleMedal: `${prefix}-rule-medal`,
    stageGroup: `${prefix}-stage-group`,
    stageKnockout: `${prefix}-stage-knockout`,
    courts: [
      `${prefix}-court-1`,
      `${prefix}-court-2`,
      `${prefix}-court-3`,
      `${prefix}-court-4`,
    ],
  };
}

function rulesFor(sport: DemoSport) {
  if (sport === "pickleball") {
    return {
      group: PICKLEBALL_GROUP_RULE,
      knockout: PICKLEBALL_KNOCKOUT_RULE,
      medal: PICKLEBALL_MEDAL_RULE,
    };
  }
  return {
    group: BADMINTON_GROUP_RULE,
    knockout: BADMINTON_KNOCKOUT_RULE,
    medal: BADMINTON_MEDAL_RULE,
  };
}

function clubsFor(sport: DemoSport) {
  return sport === "pickleball" ? PICKLEBALL_CLUBS : BADMINTON_CLUBS;
}

function clubId(sport: DemoSport, index: number): string {
  return `seed-scenario-${sport}-club-${String(index + 1).padStart(2, "0")}`;
}

function playerId(sport: DemoSport, index: number): string {
  return `seed-scenario-${sport}-player-${String(index + 1).padStart(3, "0")}`;
}

function entryId(prefix: string, index: number): string {
  return `${prefix}-entry-${String(index + 1).padStart(2, "0")}`;
}

export function playerName(sport: DemoSport, index: number): string {
  const firstIndex =
    sport === "pickleball"
      ? (index * 3 + 7) % FIRST_NAMES.length
      : index % FIRST_NAMES.length;
  const lastIndex =
    sport === "pickleball"
      ? (index + 5) % LAST_NAMES.length
      : index % LAST_NAMES.length;
  const suffix = index >= 32 ? ` ${Math.floor(index / 32) + 1}` : "";
  return `${LAST_NAMES[lastIndex]} ${FIRST_NAMES[firstIndex]}${suffix}`;
}

function ruleSnapshot(rule: RuleDefinition): MatchRuleSnapshot {
  return {
    bestOfSets: rule.bestOfSets,
    pointsToWin: rule.pointsToWin,
    winBy: rule.winBy,
    maxPoints: rule.maxPoints,
    deuceEnabled: true,
    decidingSetPoints: null,
    decidingSetWinBy: null,
    decidingSetMaxPoints: null,
    changeEndsEnabled: true,
    changeEndsAt: rule.changeEndsAt,
    name: rule.name,
  };
}

async function upsertAdmin(db: AppDatabase): Promise<void> {
  const now = nowIso();
  const passwordHash = await hashPassword(
    process.env.SEED_ADMIN_PASSWORD ?? "admin123",
  );
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, ADMIN_ID))
    .limit(1);
  const values = {
    username: process.env.SEED_ADMIN_USERNAME ?? "admin",
    passwordHash,
    displayName: process.env.SEED_ADMIN_DISPLAY_NAME ?? "Local Admin",
    role: "SUPER_ADMIN" as const,
    active: true,
    updatedAt: now,
  };
  if (existing) {
    await db.update(users).set(values).where(eq(users.id, ADMIN_ID));
  } else {
    await db.insert(users).values({
      id: ADMIN_ID,
      ...values,
      createdAt: now,
    });
  }
}

async function upsertSportDirectory(
  db: AppDatabase,
  sport: DemoSport,
): Promise<void> {
  const now = nowIso();
  const clubDefinitions = clubsFor(sport);
  for (let index = 0; index < clubDefinitions.length; index += 1) {
    const [name, shortName] = clubDefinitions[index]!;
    const id = clubId(sport, index);
    const [existing] = await db
      .select()
      .from(clubs)
      .where(eq(clubs.id, id))
      .limit(1);
    const values = {
      ownerUserId: ADMIN_ID,
      name,
      shortName,
      logoUrl: null,
      updatedAt: now,
    };
    if (existing) {
      await db.update(clubs).set(values).where(eq(clubs.id, id));
    } else {
      await db.insert(clubs).values({ id, ...values, createdAt: now });
    }
  }

  for (let index = 0; index < 64; index += 1) {
    const id = playerId(sport, index);
    const name = playerName(sport, index);
    const values = {
      name,
      ownerUserId: ADMIN_ID,
      displayName: name,
      gender: "MALE" as const,
      dateOfBirth: null,
      phone: null,
      email: null,
      metadataJson: JSON.stringify({ sport: sport.toUpperCase() }),
      updatedAt: now,
    };
    const [existing] = await db
      .select()
      .from(players)
      .where(eq(players.id, id))
      .limit(1);
    if (existing) {
      await db.update(players).set(values).where(eq(players.id, id));
    } else {
      await db.insert(players).values({ id, ...values, createdAt: now });
    }
    const profileClubId = clubId(sport, index % clubDefinitions.length);
    const profileSportId =
      sport === "pickleball" ? SPORT_IDS.PICKLEBALL : SPORT_IDS.BADMINTON;
    await db
      .insert(playerSports)
      .values({
        playerId: id,
        sportId: profileSportId,
        clubId: profileClubId,
        ranking: index + 1,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [playerSports.playerId, playerSports.sportId],
        set: {
          clubId: profileClubId,
          ranking: index + 1,
          updatedAt: now,
        },
      });
  }
}

async function upsertRule(
  db: AppDatabase,
  id: string,
  eventIdValue: string,
  definition: RuleDefinition,
): Promise<void> {
  const now = nowIso();
  const values = {
    eventId: eventIdValue,
    name: definition.name,
    bestOfSets: definition.bestOfSets,
    pointsToWin: definition.pointsToWin,
    winBy: definition.winBy,
    maxPoints: definition.maxPoints,
    deuceEnabled: true,
    decidingSetPoints: null,
    decidingSetWinBy: null,
    decidingSetMaxPoints: null,
    changeEndsEnabled: true,
    changeEndsAt: definition.changeEndsAt,
    updatedAt: now,
  };
  const [existing] = await db
    .select()
    .from(matchRules)
    .where(eq(matchRules.id, id))
    .limit(1);
  if (existing) {
    await db.update(matchRules).set(values).where(eq(matchRules.id, id));
  } else {
    await db.insert(matchRules).values({ id, ...values, createdAt: now });
  }
}

async function upsertScenarioBase(
  db: AppDatabase,
  definition: DemoScenarioDefinition,
  pinHash: string,
): Promise<ScenarioContext> {
  const ids = idsFor(definition.prefix);
  const now = nowIso();
  const [existingTournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, ids.tournament))
    .limit(1);
  const tournamentValues = {
    ownerUserId: ADMIN_ID,
    sportId:
      definition.sport === "pickleball"
        ? SPORT_IDS.PICKLEBALL
        : SPORT_IDS.BADMINTON,
    name: definition.name,
    slug: definition.slug,
    description: `${definition.sport === "pickleball" ? "Pickleball" : "Cầu lông"} demo — 32 đôi nam, 8 bảng × 4, 4 sân.`,
    location: definition.location,
    timezone: TIMEZONE,
    startDate: definition.startDate,
    endDate: definition.endDate,
    updatedAt: now,
  };
  if (existingTournament) {
    await db
      .update(tournaments)
      .set(tournamentValues)
      .where(eq(tournaments.id, ids.tournament));
  } else {
    await db.insert(tournaments).values({
      id: ids.tournament,
      ...tournamentValues,
      status: "DRAFT",
      createdAt: now,
    });
  }

  const [existingEvent] = await db
    .select()
    .from(tournamentEvents)
    .where(eq(tournamentEvents.id, ids.event))
    .limit(1);
  const eventValues = {
    tournamentId: ids.tournament,
    name:
      definition.sport === "pickleball"
        ? "Đôi nam Pickleball"
        : "Đôi nam Cầu lông",
    type: "DOUBLES" as const,
    genderCategory: "MALE" as const,
    thirdPlaceMatchEnabled: true,
    updatedAt: now,
  };
  if (existingEvent) {
    await db
      .update(tournamentEvents)
      .set(eventValues)
      .where(eq(tournamentEvents.id, ids.event));
  } else {
    await db.insert(tournamentEvents).values({
      id: ids.event,
      ...eventValues,
      status: "SETUP",
      defaultMatchRuleId: null,
      createdAt: now,
    });
  }

  const definitions = rulesFor(definition.sport);
  await upsertRule(db, ids.ruleGroup, ids.event, definitions.group);
  await upsertRule(db, ids.ruleKnockout, ids.event, definitions.knockout);
  await upsertRule(db, ids.ruleMedal, ids.event, definitions.medal);
  await db
    .update(tournamentEvents)
    .set({ defaultMatchRuleId: ids.ruleGroup, updatedAt: now })
    .where(eq(tournamentEvents.id, ids.event));

  const stageDefinitions = [
    {
      id: ids.stageGroup,
      type: "GROUP",
      name: "Vòng bảng",
      orderIndex: 0,
      format: "GROUP" as const,
      ruleId: ids.ruleGroup,
    },
    {
      id: ids.stageKnockout,
      type: "KNOCKOUT",
      name: "Vòng loại trực tiếp",
      orderIndex: 1,
      format: "KNOCKOUT" as const,
      ruleId: ids.ruleKnockout,
    },
  ];
  for (const stageDefinition of stageDefinitions) {
    const [existingStage] = await db
      .select()
      .from(stages)
      .where(eq(stages.id, stageDefinition.id))
      .limit(1);
    const values = {
      eventId: ids.event,
      type: stageDefinition.type,
      name: stageDefinition.name,
      orderIndex: stageDefinition.orderIndex,
      format: stageDefinition.format,
      updatedAt: now,
    };
    if (existingStage) {
      await db
        .update(stages)
        .set(values)
        .where(eq(stages.id, stageDefinition.id));
    } else {
      await db.insert(stages).values({
        id: stageDefinition.id,
        ...values,
        status: "PENDING",
        createdAt: now,
      });
    }
    const [existingStageRule] = await db
      .select()
      .from(stageRules)
      .where(eq(stageRules.stageId, stageDefinition.id))
      .limit(1);
    if (existingStageRule) {
      await db
        .update(stageRules)
        .set({ matchRuleId: stageDefinition.ruleId })
        .where(eq(stageRules.stageId, stageDefinition.id));
    } else {
      await db.insert(stageRules).values({
        stageId: stageDefinition.id,
        matchRuleId: stageDefinition.ruleId,
      });
    }
  }

  for (let index = 0; index < ids.courts.length; index += 1) {
    const id = ids.courts[index]!;
    const values = {
      tournamentId: ids.tournament,
      name: `Sân ${index + 1}`,
      code: `C${index + 1}`,
      active: true,
      accessPinHash: pinHash,
      updatedAt: now,
    };
    const [existingCourt] = await db
      .select()
      .from(courts)
      .where(eq(courts.id, id))
      .limit(1);
    if (existingCourt) {
      await db.update(courts).set(values).where(eq(courts.id, id));
    } else {
      await db.insert(courts).values({ id, ...values, createdAt: now });
    }
  }

  const sportClubs = clubsFor(definition.sport);
  for (let index = 0; index < 32; index += 1) {
    const id = entryId(definition.prefix, index);
    const firstPlayerId = playerId(definition.sport, index * 2);
    const secondPlayerId = playerId(definition.sport, index * 2 + 1);
    const playerAName = playerName(definition.sport, index * 2);
    const playerBName = playerName(definition.sport, index * 2 + 1);
    const seed = index < 8 ? index + 1 : null;
    const values = {
      eventId: ids.event,
      displayName: `${playerAName} / ${playerBName}${seed ? ` [S${seed}]` : ""}`,
      seed,
      ranking: index + 1,
      clubId: clubId(definition.sport, index % sportClubs.length),
      status: "ACTIVE" as const,
      updatedAt: now,
    };
    const [existingEntry] = await db
      .select()
      .from(entries)
      .where(eq(entries.id, id))
      .limit(1);
    if (existingEntry) {
      await db.update(entries).set(values).where(eq(entries.id, id));
    } else {
      await db.insert(entries).values({ id, ...values, createdAt: now });
    }

    const members = await db
      .select()
      .from(entryMembers)
      .where(eq(entryMembers.entryId, id));
    if (members.length === 0) {
      await db.insert(entryMembers).values([
        { entryId: id, playerId: firstPlayerId, position: 1 },
        { entryId: id, playerId: secondPlayerId, position: 2 },
      ]);
    }
  }

  const [currentTournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, ids.tournament))
    .limit(1);
  if (
    currentTournament &&
    (currentTournament.status === "DRAFT" ||
      currentTournament.status === "REGISTRATION")
  ) {
    await db
      .update(tournaments)
      .set({ status: "DRAW", updatedAt: now })
      .where(eq(tournaments.id, ids.tournament));
  }

  const [currentEvent] = await db
    .select()
    .from(tournamentEvents)
    .where(eq(tournamentEvents.id, ids.event))
    .limit(1);
  if (currentEvent?.status === "SETUP") {
    await db
      .update(tournamentEvents)
      .set({ status: "DRAW_READY", updatedAt: now })
      .where(eq(tournamentEvents.id, ids.event));
  }

  return { definition, ids };
}

function parseSnapshot(match: MatchRecord): MatchRuleSnapshot {
  return JSON.parse(match.ruleSnapshotJson) as MatchRuleSnapshot;
}

export function normalScoreForMatch(
  match: MatchRecord,
  variant: number,
): Array<{ setNumber: number; scoreA: number; scoreB: number }> {
  const rule = parseSnapshot(match);
  const losingScore = Math.max(0, rule.pointsToWin - 5 - (variant % 3));
  if (rule.bestOfSets === 1) {
    return [
      {
        setNumber: 1,
        scoreA: rule.pointsToWin,
        scoreB: losingScore,
      },
    ];
  }
  if (variant % 3 === 0) {
    return [
      {
        setNumber: 1,
        scoreA: rule.pointsToWin,
        scoreB: losingScore,
      },
      {
        setNumber: 2,
        scoreA: losingScore - 1,
        scoreB: rule.pointsToWin,
      },
      {
        setNumber: 3,
        scoreA: rule.pointsToWin,
        scoreB: losingScore - 2,
      },
    ];
  }
  return [
    {
      setNumber: 1,
      scoreA: rule.pointsToWin,
      scoreB: losingScore,
    },
    {
      setNumber: 2,
      scoreA: rule.pointsToWin,
      scoreB: Math.max(0, losingScore - 2),
    },
  ];
}

function liveScoreForMatch(
  match: MatchRecord,
): Array<{ setNumber: number; scoreA: number; scoreB: number }> {
  const rule = parseSnapshot(match);
  const leading = Math.max(3, Math.floor(rule.pointsToWin / 2));
  return [{ setNumber: 1, scoreA: leading, scoreB: leading - 2 }];
}

async function ensureDrawAndGroupMatches(
  db: AppDatabase,
  context: ScenarioContext,
): Promise<void> {
  const draws = new DrawService(db);
  const matchGeneration = new MatchGenerationService(db);
  const [event] = await db
    .select()
    .from(tournamentEvents)
    .where(eq(tournamentEvents.id, context.ids.event))
    .limit(1);
  if (!event) {
    throw new Error(`Missing event ${context.ids.event}`);
  }

  if (event.status === "DRAW_READY") {
    const existingSessions = await draws.listSessionsByStageId(
      context.ids.stageGroup,
    );
    const locked = existingSessions.find((session) => session.status === "LOCKED");
    if (!locked) {
      const generated = await draws.generateDraw(admin, {
        eventId: context.ids.event,
        stageId: context.ids.stageGroup,
        configuration: {
          seedDistribution: "SERPENTINE",
          avoidSameClub: true,
          avoidSameTeam: false,
          avoidSameRegion: false,
          groupCount: 8,
          capacityPerGroup: 4,
        },
        randomSeed: `${context.definition.prefix}-${DRAW_SEED_SUFFIX}`,
      });
      await draws.confirmDraw(admin, {
        drawSessionId: generated.session.id,
      });
    }
  }

  const groupRows = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.stageId, context.ids.stageGroup));
  if (groupRows.length === 0) {
    await matchGeneration.generateRoundRobinMatches(admin, {
      eventId: context.ids.event,
      stageId: context.ids.stageGroup,
    });
  }

  await db
    .update(tournaments)
    .set({
      status: "IN_PROGRESS",
      updatedAt: nowIso(),
    })
    .where(
      and(
        eq(tournaments.id, context.ids.tournament),
        inArray(tournaments.status, ["DRAW", "IN_PROGRESS"]),
      ),
    );
}

function scheduledIso(
  definition: DemoScenarioDefinition,
  minutesFromStart: number,
): string {
  const date = `${definition.startDate}T01:00:00.000Z`;
  return new Date(new Date(date).getTime() + minutesFromStart * 60_000).toISOString();
}

async function prepareMatch(
  db: AppDatabase,
  context: ScenarioContext,
  match: MatchRecord,
  index: number,
  stage: "group" | "knockout",
): Promise<MatchRecord> {
  const duration =
    stage === "group" ? GROUP_MATCH_MINUTES : KNOCKOUT_MATCH_MINUTES;
  const scheduledAt = scheduledIso(
    context.definition,
    index * (duration + 5),
  );
  const courtIdValue = context.ids.courts[index % context.ids.courts.length]!;
  await db
    .update(matches)
    .set({
      courtId: courtIdValue,
      scheduledAt,
      estimatedDurationMinutes: duration,
      status: match.status === "PENDING" ? "SCHEDULED" : match.status,
      updatedAt: nowIso(),
    })
    .where(eq(matches.id, match.id));
  const [updated] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, match.id))
    .limit(1);
  return updated!;
}

async function finishNormal(
  db: AppDatabase,
  match: MatchRecord,
  variant: number,
): Promise<MatchWithSets> {
  const matchOps = createMatchOpsService(db);
  const current =
    match.status === "PENDING" || match.status === "SCHEDULED"
      ? await matchOps.startMatch(admin, match.id)
      : await matchOps.getById(match.id);
  if (current.status !== "IN_PROGRESS") {
    return current;
  }
  return matchOps.enterScore(admin, {
    matchId: current.id,
    sets: normalScoreForMatch(current, variant),
    expectedUpdatedAt: current.updatedAt,
  });
}

async function finishSpecial(
  db: AppDatabase,
  match: MatchRecord,
  resolution: "WALKOVER" | "NO_SHOW" | "RETIREMENT" | "DISQUALIFICATION",
): Promise<MatchWithSets> {
  const matchOps = createMatchOpsService(db);
  const current = await matchOps.getById(match.id);
  if (
    current.status === "COMPLETED" ||
    current.status === "WALKOVER" ||
    current.status === "CANCELLED"
  ) {
    return current;
  }
  if (!current.entryAId) {
    throw new Error(`Match ${current.id} is missing entry A`);
  }
  const sets =
    resolution === "RETIREMENT"
      ? liveScoreForMatch(current)
      : undefined;
  return matchOps.resolveSpecial(admin, {
    matchId: current.id,
    winnerEntryId: current.entryAId,
    resolution,
    sets,
    expectedUpdatedAt: current.updatedAt,
  });
}

async function completeGroupStage(
  db: AppDatabase,
  context: ScenarioContext,
): Promise<void> {
  const groupMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.stageId, context.ids.stageGroup))
    .orderBy(asc(matches.groupId), asc(matches.roundNumber), asc(matches.id));
  const matchOps = createMatchOpsService(db);

  for (let index = 0; index < groupMatches.length; index += 1) {
    let current = groupMatches[index]!;
    if (
      current.status === "COMPLETED" ||
      current.status === "WALKOVER" ||
      current.status === "CANCELLED"
    ) {
      continue;
    }
    current = await prepareMatch(db, context, current, index, "group");
    if (index === 0) {
      await matchOps.cancelMatch(admin, {
        matchId: current.id,
        reason: "Demo: mưa lớn làm gián đoạn lịch thi đấu",
        expectedUpdatedAt: current.updatedAt,
      });
    } else if (index === 1) {
      await finishSpecial(db, current, "WALKOVER");
    } else if (index === 2) {
      await finishSpecial(db, current, "NO_SHOW");
    } else if (index === 3) {
      await finishSpecial(db, current, "RETIREMENT");
    } else if (index === 4) {
      await finishSpecial(db, current, "DISQUALIFICATION");
    } else {
      await finishNormal(db, current, index);
    }
  }

  const brackets = new BracketService(db);
  const [groupStage] = await db
    .select()
    .from(stages)
    .where(eq(stages.id, context.ids.stageGroup))
    .limit(1);
  if (groupStage?.status === "PENDING") {
    await new StageService(db).transitionStatus(
      admin,
      context.ids.stageGroup,
      "ACTIVE",
    );
  }
  await brackets.completeGroupStage(admin, context.ids.stageGroup);
}

async function ensureKnockoutBracket(
  db: AppDatabase,
  context: ScenarioContext,
): Promise<void> {
  const brackets = new BracketService(db);
  const existingRule = await brackets.getQualificationRule(
    context.ids.stageGroup,
    context.ids.stageKnockout,
  );
  if (!existingRule) {
    await brackets.createQualificationRule(admin, {
      sourceStageId: context.ids.stageGroup,
      targetStageId: context.ids.stageKnockout,
      topPerGroup: 2,
      bestAdditionalEntries: 0,
    });
  }

  const existingMatches = await brackets.listKnockoutMatches(
    context.ids.stageKnockout,
  );
  if (existingMatches.length === 0) {
    await brackets.generateBracket(admin, {
      sourceStageId: context.ids.stageGroup,
      targetStageId: context.ids.stageKnockout,
      bracketSize: 16,
      placementRule: "BY_QUALIFICATION_SEED",
      byeAssignment: "TOP_SEEDS",
      thirdPlaceEnabled: true,
      avoidSameGroupRoundOne: true,
    });
  }

  const [knockoutStage] = await db
    .select()
    .from(stages)
    .where(eq(stages.id, context.ids.stageKnockout))
    .limit(1);
  if (knockoutStage?.status === "PENDING") {
    await new StageService(db).transitionStatus(
      admin,
      context.ids.stageKnockout,
      "ACTIVE",
    );
  }

  const definitions = rulesFor(context.definition.sport);
  const medalSnapshot = JSON.stringify(ruleSnapshot(definitions.medal));
  const knockoutMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.stageId, context.ids.stageKnockout));
  const finalRound = Math.max(
    ...knockoutMatches
      .filter((match) => !match.isThirdPlace)
      .map((match) => match.roundNumber),
  );
  const medalIds = knockoutMatches
    .filter(
      (match) => match.isThirdPlace || match.roundNumber === finalRound,
    )
    .map((match) => match.id);
  if (medalIds.length > 0) {
    await db
      .update(matches)
      .set({ ruleSnapshotJson: medalSnapshot, updatedAt: nowIso() })
      .where(inArray(matches.id, medalIds));
  }
}

async function seedLiveKnockout(
  db: AppDatabase,
  context: ScenarioContext,
): Promise<void> {
  const firstRound = await db
    .select()
    .from(matches)
    .where(
      and(
        eq(matches.stageId, context.ids.stageKnockout),
        eq(matches.roundNumber, 0),
      ),
    )
    .orderBy(asc(matches.bracketPosition));

  for (let index = 0; index < firstRound.length; index += 1) {
    let current = firstRound[index]!;
    if (
      current.status === "COMPLETED" ||
      current.status === "WALKOVER" ||
      current.status === "CANCELLED"
    ) {
      continue;
    }

    if (index < 3) {
      current = await prepareMatch(db, context, current, index, "knockout");
      await finishNormal(db, current, index);
      continue;
    }

    if (index === 3) {
      current = await prepareMatch(db, context, current, index, "knockout");
      const matchOps = createMatchOpsService(db);
      const started =
        current.status === "IN_PROGRESS"
          ? await matchOps.getById(current.id)
          : await matchOps.startMatch(admin, current.id);
      await matchOps.saveLiveScore(admin, {
        matchId: started.id,
        sets: liveScoreForMatch(started),
        expectedUpdatedAt: started.updatedAt,
      });
      continue;
    }

    if (index === 4) {
      current = await prepareMatch(db, context, current, index, "knockout");
      const warmupUntil = new Date(Date.now() + 10 * 60_000).toISOString();
      await db
        .update(matches)
        .set({ warmupUntil, updatedAt: nowIso() })
        .where(eq(matches.id, current.id));
      continue;
    }

    if (index === 5) {
      await prepareMatch(db, context, current, index, "knockout");
      continue;
    }

    await db
      .update(matches)
      .set({
        status: "PENDING",
        courtId: null,
        scheduledAt: null,
        estimatedDurationMinutes: null,
        warmupUntil: null,
        updatedAt: nowIso(),
      })
      .where(eq(matches.id, current.id));
  }

  await db
    .update(tournaments)
    .set({
      status: "IN_PROGRESS",
      description: `${context.definition.sport === "pickleball" ? "Pickleball" : "Cầu lông"} demo live: vòng bảng hoàn tất, vòng 1/8 có trận chờ, đã gọi sân, đang đấu và đã xong.`,
      updatedAt: nowIso(),
    })
    .where(eq(tournaments.id, context.ids.tournament));
}

async function completeKnockout(
  db: AppDatabase,
  context: ScenarioContext,
): Promise<void> {
  const roundNumbers = [
    ...new Set(
      (
        await db
          .select({ roundNumber: matches.roundNumber })
          .from(matches)
          .where(eq(matches.stageId, context.ids.stageKnockout))
      ).map((row) => row.roundNumber),
    ),
  ].sort((a, b) => a - b);

  let scheduleIndex = 0;
  for (const roundNumber of roundNumbers) {
    const roundMatches = await db
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.stageId, context.ids.stageKnockout),
          eq(matches.roundNumber, roundNumber),
        ),
      )
      .orderBy(asc(matches.isThirdPlace), asc(matches.bracketPosition));
    for (let index = 0; index < roundMatches.length; index += 1) {
      let current = roundMatches[index]!;
      if (
        current.status === "COMPLETED" ||
        current.status === "WALKOVER" ||
        current.status === "CANCELLED"
      ) {
        scheduleIndex += 1;
        continue;
      }
      const [fresh] = await db
        .select()
        .from(matches)
        .where(eq(matches.id, current.id))
        .limit(1);
      current = fresh!;
      if (!current.entryAId || !current.entryBId) {
        throw new Error(
          `Knockout match ${current.id} has incomplete slots in round ${roundNumber}`,
        );
      }
      current = await prepareMatch(
        db,
        context,
        current,
        48 + scheduleIndex,
        "knockout",
      );

      if (roundNumber === 0 && index === 0) {
        await finishSpecial(db, current, "WALKOVER");
      } else if (roundNumber === 0 && index === 1) {
        await finishSpecial(db, current, "NO_SHOW");
      } else if (roundNumber === 0 && index === 2) {
        await finishSpecial(db, current, "RETIREMENT");
      } else if (roundNumber === 0 && index === 3) {
        await finishSpecial(db, current, "DISQUALIFICATION");
      } else {
        await finishNormal(db, current, scheduleIndex);
      }
      scheduleIndex += 1;
    }
  }

  const [knockoutStage] = await db
    .select()
    .from(stages)
    .where(eq(stages.id, context.ids.stageKnockout))
    .limit(1);
  if (knockoutStage?.status === "ACTIVE") {
    await new StageService(db).transitionStatus(
      admin,
      context.ids.stageKnockout,
      "COMPLETED",
    );
  }

  await db
    .update(tournamentEvents)
    .set({ status: "COMPLETED", updatedAt: nowIso() })
    .where(eq(tournamentEvents.id, context.ids.event));
  await db
    .update(tournaments)
    .set({
      status: "COMPLETED",
      description: `${context.definition.sport === "pickleball" ? "Pickleball" : "Cầu lông"} demo hoàn tất: 32 đôi nam, 8 bảng × 4, đầy đủ kết quả và podium.`,
      updatedAt: nowIso(),
    })
    .where(eq(tournaments.id, context.ids.tournament));
}

async function advanceScenario(
  db: AppDatabase,
  context: ScenarioContext,
): Promise<void> {
  if (context.definition.state === "draw-ready") {
    return;
  }

  const [event] = await db
    .select()
    .from(tournamentEvents)
    .where(eq(tournamentEvents.id, context.ids.event))
    .limit(1);
  if (
    context.definition.state === "completed" &&
    event?.status === "COMPLETED"
  ) {
    return;
  }

  await ensureDrawAndGroupMatches(db, context);
  await completeGroupStage(db, context);
  await ensureKnockoutBracket(db, context);

  if (context.definition.state === "knockout-live") {
    await seedLiveKnockout(db, context);
  } else {
    await completeKnockout(db, context);
  }
}

function countBy<T extends string | null>(
  values: T[],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) {
    const key = value ?? "NONE";
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

async function summarizeScenario(
  db: AppDatabase,
  context: ScenarioContext,
): Promise<ScenarioSummary> {
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, context.ids.tournament))
    .limit(1);
  const [event] = await db
    .select()
    .from(tournamentEvents)
    .where(eq(tournamentEvents.id, context.ids.event))
    .limit(1);
  const eventEntries = await db
    .select({ id: entries.id })
    .from(entries)
    .where(eq(entries.eventId, context.ids.event));
  const allMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.eventId, context.ids.event));
  const finalRound = Math.max(
    -1,
    ...allMatches
      .filter(
        (match) =>
          match.stageId === context.ids.stageKnockout && !match.isThirdPlace,
      )
      .map((match) => match.roundNumber),
  );
  const final = allMatches.find(
    (match) =>
      match.stageId === context.ids.stageKnockout &&
      !match.isThirdPlace &&
      match.roundNumber === finalRound,
  );
  const thirdPlaceMatch = allMatches.find(
    (match) =>
      match.stageId === context.ids.stageKnockout && match.isThirdPlace,
  );
  const runnerUpId = final?.winnerEntryId
    ? final.winnerEntryId === final.entryAId
      ? final.entryBId
      : final.entryAId
    : null;
  const podiumIds = [
    final?.winnerEntryId,
    runnerUpId,
    thirdPlaceMatch?.winnerEntryId,
  ].filter((id): id is string => Boolean(id));
  const podiumEntries =
    podiumIds.length > 0
      ? await db.select().from(entries).where(inArray(entries.id, podiumIds))
      : [];
  const podiumNames = new Map(
    podiumEntries.map((entry) => [entry.id, entry.displayName]),
  );

  return {
    name: tournament!.name,
    slug: tournament!.slug,
    tournamentStatus: tournament!.status,
    eventStatus: event!.status,
    entries: eventEntries.length,
    groupMatches: allMatches.filter(
      (match) => match.stageId === context.ids.stageGroup,
    ).length,
    knockoutMatches: allMatches.filter(
      (match) => match.stageId === context.ids.stageKnockout,
    ).length,
    statuses: countBy(allMatches.map((match) => match.status)),
    resolutions: countBy(allMatches.map((match) => match.resolution)),
    calledToCourt: allMatches.filter((match) => match.warmupUntil != null)
      .length,
    champion: final?.winnerEntryId
      ? (podiumNames.get(final.winnerEntryId) ?? null)
      : null,
    runnerUp: runnerUpId ? (podiumNames.get(runnerUpId) ?? null) : null,
    thirdPlace: thirdPlaceMatch?.winnerEntryId
      ? (podiumNames.get(thirdPlaceMatch.winnerEntryId) ?? null)
      : null,
  };
}

function assertScenarioSummary(
  definition: DemoScenarioDefinition,
  summary: ScenarioSummary,
): void {
  if (summary.entries !== 32) {
    throw new Error(`${definition.slug}: expected 32 entries`);
  }
  if (definition.state === "draw-ready") {
    if (
      summary.groupMatches !== 0 ||
      summary.knockoutMatches !== 0 ||
      summary.eventStatus !== "DRAW_READY"
    ) {
      throw new Error(`${definition.slug}: invalid draw-ready snapshot`);
    }
    return;
  }
  if (summary.groupMatches !== 48 || summary.knockoutMatches !== 16) {
    throw new Error(
      `${definition.slug}: expected 48 group and 16 knockout matches`,
    );
  }
  for (const resolution of [
    "NORMAL",
    "WALKOVER",
    "NO_SHOW",
    "RETIREMENT",
    "DISQUALIFICATION",
  ]) {
    if (!summary.resolutions[resolution]) {
      throw new Error(`${definition.slug}: missing ${resolution} result`);
    }
  }
  if (!summary.statuses.CANCELLED) {
    throw new Error(`${definition.slug}: missing CANCELLED match`);
  }
  if (definition.state === "knockout-live") {
    for (const status of [
      "PENDING",
      "SCHEDULED",
      "IN_PROGRESS",
      "COMPLETED",
      "WALKOVER",
      "CANCELLED",
    ]) {
      if (!summary.statuses[status]) {
        throw new Error(`${definition.slug}: missing ${status} status`);
      }
    }
    if (summary.calledToCourt < 1) {
      throw new Error(`${definition.slug}: missing called-to-court match`);
    }
  }
  if (
    definition.state === "completed" &&
    (summary.tournamentStatus !== "COMPLETED" ||
      summary.eventStatus !== "COMPLETED" ||
      !summary.champion ||
      !summary.runnerUp ||
      !summary.thirdPlace)
  ) {
    throw new Error(`${definition.slug}: completed snapshot has no podium`);
  }
}

export async function seedDemoScenarios(
  db: AppDatabase,
): Promise<ScenarioSummary[]> {
  await upsertAdmin(db);
  await upsertSportDirectory(db, "badminton");
  await upsertSportDirectory(db, "pickleball");
  const pinHash = await hashPassword(COURT_PIN);

  const contexts: ScenarioContext[] = [];
  for (const definition of DEMO_SCENARIOS) {
    const context = await upsertScenarioBase(db, definition, pinHash);
    contexts.push(context);
    await advanceScenario(db, context);
  }

  const summaries: ScenarioSummary[] = [];
  for (const context of contexts) {
    const summary = await summarizeScenario(db, context);
    assertScenarioSummary(context.definition, summary);
    summaries.push(summary);
  }
  return summaries;
}

function printSummary(summaries: ScenarioSummary[]): void {
  console.log("Demo scenario seed completed:");
  for (const summary of summaries) {
    console.log(`\n${summary.name}`);
    console.log(`  Public: /t/${summary.slug}`);
    console.log(
      `  Status: ${summary.tournamentStatus} / ${summary.eventStatus}`,
    );
    console.log(
      `  Entries: ${summary.entries}; matches: ${summary.groupMatches} group + ${summary.knockoutMatches} knockout`,
    );
    console.log(`  Match statuses: ${JSON.stringify(summary.statuses)}`);
    console.log(`  Resolutions: ${JSON.stringify(summary.resolutions)}`);
    if (summary.champion) {
      console.log(
        `  Podium: ${summary.champion} / ${summary.runnerUp} / ${summary.thirdPlace}`,
      );
    }
  }
  console.log(`\nAdmin: admin / ${process.env.SEED_ADMIN_PASSWORD ?? "admin123"}`);
  console.log(`Court PIN: ${COURT_PIN}`);
}

async function main(): Promise<void> {
  await runMigrations();
  const { db, pool } = createDb();
  try {
    const summaries = await seedDemoScenarios(db);
    printSummary(summaries);
  } finally {
    await pool.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
