/**
 * Finish all group-stage matches for the HCMC demo, then build the knockout
 * bracket (top 2 per group → R16). Idempotent — safe to re-run.
 *
 * Usage: pnpm db:seed:knockout
 */

import { eq } from "drizzle-orm";
import type { ActorContext } from "@/core/domain";
import {
  BracketService,
  MatchOpsService,
  StageService,
} from "@/application/services";
import { createDb, type AppDatabase } from "./client";
import { runMigrations } from "./migrate";
import { SEED_IDS } from "./seed-ids";
import { matches, tournaments } from "./schema";
import { nowIso } from "@/lib/id";

const admin: ActorContext = {
  userId: SEED_IDS.adminUser,
  role: "ADMIN",
};

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

export async function seedDemoKnockout(db: AppDatabase) {
  const matchOps = new MatchOpsService(db);
  const stages = new StageService(db);
  const brackets = new BracketService(db);

  const groupMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.stageId, SEED_IDS.stageGroup));

  if (groupMatches.length === 0) {
    throw new Error(
      "No group matches found. Run `pnpm db:seed` first to create the demo draw.",
    );
  }

  const sorted = [...groupMatches].sort((a, b) => {
    if (a.roundNumber !== b.roundNumber) {
      return a.roundNumber - b.roundNumber;
    }
    return a.id.localeCompare(b.id);
  });

  // 1) Finish every non-terminal group match (IN_PROGRESS first, then rest).
  const open = sorted.filter(
    (m) =>
      m.status !== "COMPLETED" &&
      m.status !== "WALKOVER" &&
      m.status !== "CANCELLED",
  );
  const inProgress = open.filter((m) => m.status === "IN_PROGRESS");
  const notStarted = open.filter((m) => m.status !== "IN_PROGRESS");

  let finished = 0;
  let scoreIndex = 0;

  async function finishOne(
    matchId: string,
    alreadyStarted: boolean,
  ): Promise<void> {
    let current = await matchOps.getById(matchId);
    if (
      current.status === "COMPLETED" ||
      current.status === "WALKOVER" ||
      current.status === "CANCELLED"
    ) {
      return;
    }
    if (!alreadyStarted) {
      const courtId = current.courtId ?? SEED_IDS.courts[scoreIndex % 4]!;
      current = await matchOps.startMatch(admin, current.id, undefined, {
        courtId,
      });
    }
    if (current.status === "IN_PROGRESS") {
      await matchOps.enterScore(admin, {
        matchId: current.id,
        sets: scoreForIndex(scoreIndex).sets,
        expectedUpdatedAt: current.updatedAt,
      });
      finished += 1;
    }
    scoreIndex += 1;
  }

  for (const m of inProgress) {
    await finishOne(m.id, true);
  }
  for (const m of notStarted) {
    await finishOne(m.id, false);
  }

  // 2) Ensure group stage is ACTIVE, then COMPLETED.
  const groupStage = await stages.getById(SEED_IDS.stageGroup);
  if (groupStage.status === "PENDING") {
    await stages.transitionStatus(admin, SEED_IDS.stageGroup, "ACTIVE");
  }
  await brackets.completeGroupStage(admin, SEED_IDS.stageGroup);

  // 3) Qualification: top 2 per group → 16 into knockout.
  const existingRule = await brackets.getQualificationRule(
    SEED_IDS.stageGroup,
    SEED_IDS.stageKnockout,
  );
  if (!existingRule) {
    await brackets.createQualificationRule(admin, {
      sourceStageId: SEED_IDS.stageGroup,
      targetStageId: SEED_IDS.stageKnockout,
      topPerGroup: 2,
      bestAdditionalEntries: 0,
    });
  }

  // 4) Generate / replace R16 bracket (+ third place).
  const generated = await brackets.generateBracket(admin, {
    sourceStageId: SEED_IDS.stageGroup,
    targetStageId: SEED_IDS.stageKnockout,
    bracketSize: 16,
    placementRule: "BY_QUALIFICATION_SEED",
    byeAssignment: "TOP_SEEDS",
    thirdPlaceEnabled: true,
    avoidSameGroupRoundOne: true,
  });

  const koStage = await stages.getById(SEED_IDS.stageKnockout);
  if (koStage.status === "PENDING") {
    await stages.transitionStatus(admin, SEED_IDS.stageKnockout, "ACTIVE");
  }

  const now = nowIso();
  await db
    .update(tournaments)
    .set({
      status: "IN_PROGRESS",
      description:
        "Demo sẵn sàng vòng trong: vòng bảng xong (8×4, top 2/bảng → 16), nhánh knockout đã tạo. Public: /t/hcmc-badminton-open-2026",
      updatedAt: now,
    })
    .where(eq(tournaments.id, SEED_IDS.tournament));

  return {
    groupMatchCount: groupMatches.length,
    newlyFinished: finished,
    qualifiers: generated.qualifiers.length,
    knockoutMatches: generated.matches.length,
    warnings: generated.warnings,
  };
}

async function main() {
  await runMigrations();
  const { db, pool } = createDb();
  try {
    const result = await seedDemoKnockout(db);
    console.log("Knockout seed completed:");
    console.log(`  Group matches: ${result.groupMatchCount}`);
    console.log(`  Newly finished: ${result.newlyFinished}`);
    console.log(`  Qualifiers: ${result.qualifiers}`);
    console.log(`  Knockout matches: ${result.knockoutMatches}`);
    if (result.warnings.length > 0) {
      console.log(
        `  Warnings: ${result.warnings.map((w) => w.message).join("; ")}`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
