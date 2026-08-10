import { DomainError } from "@/core/tournament-engine/errors";
import type {
  StandingCriterion,
  StandingRow,
} from "@/core/tournament-engine/standings/types";
import { QualificationErrorCode } from "./errors";
import { resolveQualificationInputSchema } from "./schemas";
import type {
  Qualifier,
  QualificationResult,
  ResolveQualificationInput,
} from "./types";

const DEFAULT_ADDITIONAL_CRITERIA: StandingCriterion[] = [
  "MATCH_WINS",
  "SET_DIFFERENCE",
  "POINT_DIFFERENCE",
  "POINTS_WON",
  "ENTRY_ID",
];

function metric(row: StandingRow, criterion: StandingCriterion): number | string {
  switch (criterion) {
    case "MATCH_WINS":
      return row.wins;
    case "SET_DIFFERENCE":
      return row.setDifference;
    case "POINT_DIFFERENCE":
      return row.pointDifference;
    case "POINTS_WON":
      return row.pointsWon;
    case "SETS_WON":
      return row.setsWon;
    case "MATCHES_PLAYED":
      return row.played;
    case "ENTRY_ID":
      return row.entryId;
    case "HEAD_TO_HEAD":
    case "DRAW_REQUIRED":
      return 0;
    default: {
      const _exhaustive: never = criterion;
      return _exhaustive;
    }
  }
}

function compareRows(
  a: StandingRow,
  b: StandingRow,
  criteria: StandingCriterion[],
): number {
  for (const criterion of criteria) {
    if (criterion === "HEAD_TO_HEAD" || criterion === "DRAW_REQUIRED") {
      continue;
    }
    if (criterion === "ENTRY_ID") {
      const cmp = String(metric(a, criterion)).localeCompare(
        String(metric(b, criterion)),
      );
      if (cmp !== 0) return cmp;
      continue;
    }
    const va = metric(a, criterion) as number;
    const vb = metric(b, criterion) as number;
    if (va !== vb) return vb - va;
  }
  return a.entryId.localeCompare(b.entryId);
}

/**
 * Selects top-N per group plus best additional entries (e.g. best thirds).
 * V1: best-additional requires equal group sizes.
 */
export function resolveQualification(
  input: ResolveQualificationInput,
): QualificationResult {
  const parsed = resolveQualificationInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(
      QualificationErrorCode.INVALID_INPUT,
      `Invalid resolveQualification input: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    );
  }

  const { standingsByGroup, rule } = parsed.data as ResolveQualificationInput;
  const additionalFromRank = rule.additionalFromRank ?? rule.topPerGroup + 1;
  const rankingCriteria = rule.rankingCriteria ?? DEFAULT_ADDITIONAL_CRITERIA;

  if (rule.bestAdditionalEntries > 0 && additionalFromRank <= rule.topPerGroup) {
    throw new DomainError(
      QualificationErrorCode.INVALID_RULE,
      "additionalFromRank must be greater than topPerGroup.",
    );
  }

  // Stable group order for seeding of automatic top-N.
  const groups = [...standingsByGroup].sort((a, b) =>
    a.groupId.localeCompare(b.groupId),
  );

  if (rule.bestAdditionalEntries > 0) {
    const sizes = groups.map((group) => group.standings.length);
    const first = sizes[0];
    if (sizes.some((size) => size !== first)) {
      throw new DomainError(
        QualificationErrorCode.UNEVEN_GROUP_SIZES,
        "V1 best-additional qualification requires all groups to have the same size.",
      );
    }
  }

  const qualifiers: Qualifier[] = [];
  let seed = 1;

  // Top N per group — group winners first (by group id), then runners-up, etc.
  for (let rank = 1; rank <= rule.topPerGroup; rank += 1) {
    for (const group of groups) {
      const row = group.standings.find((standing) => standing.rank === rank);
      if (!row) {
        throw new DomainError(
          QualificationErrorCode.INSUFFICIENT_STANDINGS,
          `Group ${group.groupId} has no standing row for rank ${rank}.`,
        );
      }
      qualifiers.push({
        entryId: row.entryId,
        sourceGroupId: group.groupId,
        sourceRank: rank,
        qualificationSeed: seed,
        isAdditional: false,
      });
      seed += 1;
    }
  }

  // Re-seed top-N by rank bands using cross-group ranking for better bracket seeding:
  // Actually architecture places by group rank; qualificationSeed as sequential is fine.
  // Better approach often used: all rank-1 sorted by criteria, then all rank-2.
  // Rebuild seeds within each rank band:
  let nextSeed = 1;
  const reseeded: Qualifier[] = [];
  for (let rank = 1; rank <= rule.topPerGroup; rank += 1) {
    const band = qualifiers
      .filter((q) => q.sourceRank === rank)
      .map((q) => {
        const group = groups.find((g) => g.groupId === q.sourceGroupId)!;
        const row = group.standings.find((s) => s.entryId === q.entryId)!;
        return { qualifier: q, row };
      })
      .sort((a, b) => compareRows(a.row, b.row, rankingCriteria));

    for (const item of band) {
      reseeded.push({
        ...item.qualifier,
        qualificationSeed: nextSeed,
      });
      nextSeed += 1;
    }
  }

  if (rule.bestAdditionalEntries > 0) {
    const candidates = groups.map((group) => {
      const row = group.standings.find(
        (standing) => standing.rank === additionalFromRank,
      );
      if (!row) {
        throw new DomainError(
          QualificationErrorCode.INSUFFICIENT_STANDINGS,
          `Group ${group.groupId} has no standing row for rank ${additionalFromRank}.`,
        );
      }
      return { groupId: group.groupId, row };
    });

    candidates.sort((a, b) => compareRows(a.row, b.row, rankingCriteria));

    const taken = candidates.slice(0, rule.bestAdditionalEntries);
    for (const candidate of taken) {
      reseeded.push({
        entryId: candidate.row.entryId,
        sourceGroupId: candidate.groupId,
        sourceRank: additionalFromRank,
        qualificationSeed: nextSeed,
        isAdditional: true,
      });
      nextSeed += 1;
    }
  }

  return { qualifiers: reseeded };
}
