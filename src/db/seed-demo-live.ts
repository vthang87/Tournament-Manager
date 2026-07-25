/**
 * Advance the HCMC demo tournament into a “live” public-board snapshot:
 * confirmed draw → round-robin matches → schedule + mixed scores.
 * Idempotent — safe to re-run with `pnpm db:seed`.
 */

import { and, eq, inArray } from "drizzle-orm";
import type { ActorContext } from "@/core/domain";
import {
  DrawService,
  MatchGenerationService,
  MatchOpsService,
} from "@/application/services";
import { addMinutesIso } from "@/core/tournament-engine/scheduling";
import type { AppDatabase } from "./client";
import { SEED_IDS } from "./seed-ids";
import { matches, tournamentEvents, tournaments } from "./schema";
import { nowIso } from "@/lib/id";

const admin: ActorContext = {
  userId: SEED_IDS.adminUser,
  role: "ADMIN",
};

const DEMO_RANDOM_SEED = "hcmc-open-2026-demo";
const MATCH_DURATION_MIN = 45;
const COURT_GAP_MIN = 10;
const ROUND_REST_MIN = 15;

function scoreForIndex(index: number): {
  sets: Array<{ setNumber: number; scoreA: number; scoreB: number }>;
} {
  // Group rule is BO1 × 21.
  if (index % 3 === 0) {
    return {
      sets: [{ setNumber: 1, scoreA: 15 + (index % 5), scoreB: 21 }],
    };
  }
  return {
    sets: [{ setNumber: 1, scoreA: 21, scoreB: 10 + (index % 9) }],
  };
}

async function scheduleByRound(db: AppDatabase): Promise<void> {
  const rows = await db
    .select()
    .from(matches)
    .where(eq(matches.eventId, SEED_IDS.eventMensDoubles));

  const needsSchedule = rows.filter(
    (m) =>
      !m.scheduledAt &&
      (m.status === "PENDING" || m.status === "SCHEDULED"),
  );
  if (needsSchedule.length === 0) {
    return;
  }

  const start = new Date();
  start.setUTCHours(1, 0, 0, 0); // ~08:00 Asia/Ho_Chi_Minh
  let roundCursor = start.toISOString();
  const courts = [...SEED_IDS.courts];
  const now = nowIso();

  const roundNumbers = [
    ...new Set(needsSchedule.map((m) => m.roundNumber)),
  ].sort((a, b) => a - b);

  for (const roundNumber of roundNumbers) {
    const roundMatches = needsSchedule
      .filter((m) => m.roundNumber === roundNumber)
      .sort((a, b) => a.id.localeCompare(b.id));

    for (let i = 0; i < roundMatches.length; i++) {
      const match = roundMatches[i]!;
      const courtId = courts[i % courts.length]!;
      const wave = Math.floor(i / courts.length);
      const scheduledAt = addMinutesIso(
        roundCursor,
        wave * (MATCH_DURATION_MIN + COURT_GAP_MIN),
      );
      await db
        .update(matches)
        .set({
          courtId,
          scheduledAt,
          estimatedDurationMinutes: MATCH_DURATION_MIN,
          status: "SCHEDULED",
          updatedAt: now,
        })
        .where(eq(matches.id, match.id));
    }

    const waves = Math.ceil(roundMatches.length / courts.length);
    roundCursor = addMinutesIso(
      roundCursor,
      waves * (MATCH_DURATION_MIN + COURT_GAP_MIN) + ROUND_REST_MIN,
    );
  }
}

export async function seedDemoLiveSimulation(db: AppDatabase): Promise<void> {
  const draws = new DrawService(db);
  const matchGen = new MatchGenerationService(db);
  const matchOps = new MatchOpsService(db);

  const [event] = await db
    .select()
    .from(tournamentEvents)
    .where(eq(tournamentEvents.id, SEED_IDS.eventMensDoubles))
    .limit(1);
  if (!event) {
    return;
  }

  // 1) Confirm draw (8×4) when still DRAW_READY.
  if (event.status === "DRAW_READY") {
    const generated = await draws.generateDraw(admin, {
      eventId: SEED_IDS.eventMensDoubles,
      stageId: SEED_IDS.stageGroup,
      configuration: {
        seedDistribution: "SERPENTINE",
        avoidSameClub: true,
        avoidSameTeam: false,
        avoidSameRegion: false,
        groupCount: 8,
        capacityPerGroup: 4,
      },
      randomSeed: DEMO_RANDOM_SEED,
    });
    await draws.confirmDraw(admin, {
      drawSessionId: generated.session.id,
    });
  }

  const eventAfterDraw = (
    await db
      .select()
      .from(tournamentEvents)
      .where(eq(tournamentEvents.id, SEED_IDS.eventMensDoubles))
      .limit(1)
  )[0];
  if (
    !eventAfterDraw ||
    (eventAfterDraw.status !== "DRAW_CONFIRMED" &&
      eventAfterDraw.status !== "IN_PROGRESS")
  ) {
    return;
  }

  // 2) Generate RR matches (idempotent via generation keys).
  const existingMatches = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.eventId, SEED_IDS.eventMensDoubles));

  if (existingMatches.length === 0) {
    await matchGen.generateRoundRobinMatches(admin, {
      eventId: SEED_IDS.eventMensDoubles,
      stageId: SEED_IDS.stageGroup,
    });
  }

  const allMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.eventId, SEED_IDS.eventMensDoubles));
  if (allMatches.length === 0) {
    return;
  }

  // 3) Schedule by round (avoids same-entry double booking).
  await scheduleByRound(db);

  const scheduled = await db
    .select()
    .from(matches)
    .where(eq(matches.eventId, SEED_IDS.eventMensDoubles));
  const sorted = [...scheduled].sort((a, b) => {
    if (a.roundNumber !== b.roundNumber) {
      return a.roundNumber - b.roundNumber;
    }
    return (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "");
  });

  // 4) Live snapshot: a few IN_PROGRESS, many COMPLETED, rest stay SCHEDULED.
  const liveCount = Math.min(4, sorted.length);
  const completeCount = Math.min(
    Math.max(24, Math.floor(sorted.length * 0.45)),
    Math.max(0, sorted.length - liveCount),
  );

  const liveIds = sorted.slice(0, liveCount);
  const completeIds = sorted.slice(liveCount, liveCount + completeCount);

  for (const match of liveIds) {
    let current =
      match.status === "PENDING" || match.status === "SCHEDULED"
        ? await matchOps.startMatch(admin, match.id)
        : await matchOps.getById(match.id);
    if (current.status === "IN_PROGRESS" && current.sets.length === 0) {
      // Mid-match sample score for the live board (set 1 in progress).
      const offset = liveIds.indexOf(match);
      await matchOps.saveLiveScore(admin, {
        matchId: current.id,
        sets: [
          {
            setNumber: 1,
            scoreA: 11 + (offset % 8),
            scoreB: 9 + ((offset * 3) % 7),
          },
        ],
        expectedUpdatedAt: current.updatedAt,
      });
    }
  }

  let scoreIndex = 0;
  for (const match of completeIds) {
    if (
      match.status === "COMPLETED" ||
      match.status === "WALKOVER" ||
      match.status === "CANCELLED"
    ) {
      scoreIndex += 1;
      continue;
    }
    let current = match;
    if (current.status === "PENDING" || current.status === "SCHEDULED") {
      current = await matchOps.startMatch(admin, current.id);
    }
    if (current.status === "IN_PROGRESS") {
      await matchOps.enterScore(admin, {
        matchId: current.id,
        sets: scoreForIndex(scoreIndex).sets,
        expectedUpdatedAt: current.updatedAt,
      });
    }
    scoreIndex += 1;
  }

  // 5) Mark tournament live for public/live boards.
  const now = nowIso();
  await db
    .update(tournaments)
    .set({
      status: "IN_PROGRESS",
      description:
        "Demo đang diễn ra: 32 đôi nam, 8 bảng × 4, lịch sân + kết quả vòng bảng mẫu. Public: /t/hcmc-badminton-open-2026",
      updatedAt: now,
    })
    .where(eq(tournaments.id, SEED_IDS.tournament));

  await db
    .update(tournamentEvents)
    .set({
      status: "IN_PROGRESS",
      updatedAt: now,
    })
    .where(
      and(
        eq(tournamentEvents.id, SEED_IDS.eventMensDoubles),
        inArray(tournamentEvents.status, ["DRAW_CONFIRMED", "IN_PROGRESS"]),
      ),
    );
}
