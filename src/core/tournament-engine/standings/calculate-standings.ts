import { DomainError } from "@/core/tournament-engine/errors";
import { StandingsErrorCode } from "./errors";
import { calculateStandingsInputSchema } from "./schemas";
import {
  DEFAULT_SPECIAL_POLICY,
  type CalculateStandingsInput,
  type SpecialResolutionPolicy,
  type StandingCriterion,
  type StandingMatch,
  type StandingMatchResolution,
  type StandingRow,
  type StandingRule,
  type StandingsSpecialPolicy,
  type TieBreakStep,
} from "./types";

type Agg = {
  entryId: string;
  played: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
};

function emptyAgg(entryId: string): Agg {
  return {
    entryId,
    played: 0,
    wins: 0,
    losses: 0,
    setsWon: 0,
    setsLost: 0,
    pointsWon: 0,
    pointsLost: 0,
  };
}

function resolutionOf(match: StandingMatch): StandingMatchResolution {
  if (match.resolution) return match.resolution;
  return "NORMAL";
}

function policyFor(
  resolution: StandingMatchResolution,
  special: StandingsSpecialPolicy,
): SpecialResolutionPolicy & { includePlayedSets?: boolean } {
  switch (resolution) {
    case "WALKOVER":
      return special.walkover;
    case "RETIREMENT":
      return special.retirement;
    case "DISQUALIFICATION":
      return special.disqualification;
    case "NO_SHOW":
      return special.noShow;
    default:
      return { setsWon: 0, setsLost: 0, pointsWon: 0, pointsLost: 0 };
  }
}

function applyCompletedMatch(
  aggs: Map<string, Agg>,
  match: StandingMatch,
  special: StandingsSpecialPolicy,
): void {
  if (!match.winnerEntryId) return;

  const entryA = aggs.get(match.entryAId);
  const entryB = aggs.get(match.entryBId);
  if (!entryA || !entryB) {
    throw new DomainError(
      StandingsErrorCode.UNKNOWN_ENTRY,
      `Match ${match.id} references unknown entry.`,
    );
  }

  if (
    match.winnerEntryId !== match.entryAId &&
    match.winnerEntryId !== match.entryBId
  ) {
    throw new DomainError(
      StandingsErrorCode.INVALID_MATCH,
      `Match ${match.id} winner is not a participant.`,
    );
  }

  const winner = match.winnerEntryId === match.entryAId ? entryA : entryB;
  const loser = match.winnerEntryId === match.entryAId ? entryB : entryA;

  winner.played += 1;
  loser.played += 1;
  winner.wins += 1;
  loser.losses += 1;

  const resolution = resolutionOf(match);
  const policy = policyFor(resolution, special);

  if (resolution === "NORMAL") {
    for (const set of match.sets) {
      entryA.pointsWon += set.scoreA;
      entryA.pointsLost += set.scoreB;
      entryB.pointsWon += set.scoreB;
      entryB.pointsLost += set.scoreA;

      if (set.scoreA === set.scoreB) continue;
      if (set.scoreA > set.scoreB) {
        entryA.setsWon += 1;
        entryB.setsLost += 1;
      } else {
        entryB.setsWon += 1;
        entryA.setsLost += 1;
      }
    }
    return;
  }

  // Special resolutions.
  const includePlayed = policy.includePlayedSets === true;
  const hasScoredSets = match.sets.length > 0;

  if (includePlayed && hasScoredSets) {
    for (const set of match.sets) {
      entryA.pointsWon += set.scoreA;
      entryA.pointsLost += set.scoreB;
      entryB.pointsWon += set.scoreB;
      entryB.pointsLost += set.scoreA;
      if (set.scoreA === set.scoreB) continue;
      if (set.scoreA > set.scoreB) {
        entryA.setsWon += 1;
        entryB.setsLost += 1;
      } else {
        entryB.setsWon += 1;
        entryA.setsLost += 1;
      }
    }
    // Prefer actual set scores over award pads (avoids double-counting).
    return;
  }

  winner.setsWon += policy.setsWon;
  winner.setsLost += policy.setsLost;
  winner.pointsWon += policy.pointsWon;
  winner.pointsLost += policy.pointsLost;
  loser.setsWon += policy.setsLost;
  loser.setsLost += policy.setsWon;
  loser.pointsWon += policy.pointsLost;
  loser.pointsLost += policy.pointsWon;
}

function metricValue(
  criterion: StandingCriterion,
  agg: Agg,
  miniAggs: Map<string, Agg> | null,
): number | string {
  const source = miniAggs?.get(agg.entryId) ?? agg;
  switch (criterion) {
    case "MATCH_WINS":
      return source.wins;
    case "SET_DIFFERENCE":
      return source.setsWon - source.setsLost;
    case "POINT_DIFFERENCE":
      return source.pointsWon - source.pointsLost;
    case "POINTS_WON":
      return source.pointsWon;
    case "SETS_WON":
      return source.setsWon;
    case "MATCHES_PLAYED":
      return source.played;
    case "ENTRY_ID":
      return source.entryId;
    case "HEAD_TO_HEAD":
    case "DRAW_REQUIRED":
      return 0;
    default: {
      const _exhaustive: never = criterion;
      return _exhaustive;
    }
  }
}

function compareMetric(
  criterion: StandingCriterion,
  a: Agg,
  b: Agg,
  miniAggs: Map<string, Agg> | null,
): number {
  if (criterion === "ENTRY_ID") {
    return String(metricValue(criterion, a, miniAggs)).localeCompare(
      String(metricValue(criterion, b, miniAggs)),
    );
  }

  if (criterion === "DRAW_REQUIRED" || criterion === "HEAD_TO_HEAD") {
    return 0;
  }

  const va = metricValue(criterion, a, miniAggs) as number;
  const vb = metricValue(criterion, b, miniAggs) as number;
  return vb - va; // higher is better
}

function buildMiniTable(
  entryIds: Set<string>,
  matches: StandingMatch[],
  special: StandingsSpecialPolicy,
): Map<string, Agg> {
  const mini = new Map<string, Agg>();
  for (const id of entryIds) {
    mini.set(id, emptyAgg(id));
  }

  for (const match of matches) {
    if (!match.winnerEntryId) continue;
    if (!entryIds.has(match.entryAId) || !entryIds.has(match.entryBId)) {
      continue;
    }
    applyCompletedMatch(mini, match, special);
  }

  return mini;
}

type RankedUnit = {
  entryIds: string[];
  drawRequired?: boolean;
};

/**
 * Resolves ordering for a tied group using remaining criteria.
 * 2-way H2H uses direct result; 3+ uses mini-table then subsequent criteria.
 */
function resolveTiedGroup(
  entryIds: string[],
  aggs: Map<string, Agg>,
  matches: StandingMatch[],
  criteria: StandingCriterion[],
  criterionIndex: number,
  special: StandingsSpecialPolicy,
  traces: Map<string, TieBreakStep[]>,
): RankedUnit[] {
  if (entryIds.length <= 1) {
    return [{ entryIds }];
  }

  if (criterionIndex >= criteria.length) {
    // No remaining criteria — deterministic ENTRY_ID fallback unless DRAW_REQUIRED was last.
    const sorted = [...entryIds].sort((a, b) => a.localeCompare(b));
    for (const id of sorted) {
      const steps = traces.get(id) ?? [];
      steps.push({
        criterion: "ENTRY_ID",
        groupEntryIds: [...entryIds].sort(),
        value: id,
      });
      traces.set(id, steps);
    }
    return sorted.map((id) => ({ entryIds: [id] }));
  }

  const criterion = criteria[criterionIndex]!;

  if (criterion === "DRAW_REQUIRED") {
    for (const id of entryIds) {
      const steps = traces.get(id) ?? [];
      steps.push({
        criterion: "DRAW_REQUIRED",
        groupEntryIds: [...entryIds].sort(),
        value: "DRAW_REQUIRED",
      });
      traces.set(id, steps);
    }
    return [{ entryIds: [...entryIds].sort(), drawRequired: true }];
  }

  if (criterion === "HEAD_TO_HEAD") {
    if (entryIds.length === 2) {
      const [a, b] = [...entryIds].sort();
      const direct = matches.filter(
        (match) =>
          match.winnerEntryId &&
          ((match.entryAId === a && match.entryBId === b) ||
            (match.entryAId === b && match.entryBId === a)),
      );

      if (direct.length > 0) {
        // Use most recent / aggregate: count wins in H2H matches.
        let winsA = 0;
        let winsB = 0;
        for (const match of direct) {
          if (match.winnerEntryId === a) winsA += 1;
          if (match.winnerEntryId === b) winsB += 1;
        }

        for (const id of [a, b]) {
          const steps = traces.get(id) ?? [];
          steps.push({
            criterion: "HEAD_TO_HEAD",
            groupEntryIds: [a, b],
            value: id === a ? String(winsA) : String(winsB),
          });
          traces.set(id, steps);
        }

        if (winsA !== winsB) {
          const first = winsA > winsB ? a! : b!;
          const second = first === a ? b! : a!;
          return [{ entryIds: [first] }, { entryIds: [second] }];
        }
      }

      // No decisive H2H — fall through to next criterion.
      return resolveTiedGroup(
        entryIds,
        aggs,
        matches,
        criteria,
        criterionIndex + 1,
        special,
        traces,
      );
    }

    // 3+ : mini-table, then continue with subsequent criteria on mini metrics.
    const idSet = new Set(entryIds);
    const mini = buildMiniTable(idSet, matches, special);

    for (const id of entryIds) {
      const miniAgg = mini.get(id)!;
      const steps = traces.get(id) ?? [];
      steps.push({
        criterion: "HEAD_TO_HEAD",
        groupEntryIds: [...entryIds].sort(),
        value: `mini-wins=${miniAgg.wins};setDiff=${miniAgg.setsWon - miniAgg.setsLost};pointDiff=${miniAgg.pointsWon - miniAgg.pointsLost}`,
      });
      traces.set(id, steps);
    }

    // Partition by remaining criteria starting AFTER H2H, using mini-table stats.
    return partitionByCriteria(
      entryIds,
      aggs,
      matches,
      criteria,
      criterionIndex + 1,
      special,
      traces,
      mini,
    );
  }

  // Scalar criteria: partition by metric, recurse within ties.
  return partitionByCriteria(
    entryIds,
    aggs,
    matches,
    criteria,
    criterionIndex,
    special,
    traces,
    null,
  );
}

function partitionByCriteria(
  entryIds: string[],
  aggs: Map<string, Agg>,
  matches: StandingMatch[],
  criteria: StandingCriterion[],
  criterionIndex: number,
  special: StandingsSpecialPolicy,
  traces: Map<string, TieBreakStep[]>,
  miniAggs: Map<string, Agg> | null,
): RankedUnit[] {
  if (entryIds.length <= 1) {
    return [{ entryIds }];
  }

  if (criterionIndex >= criteria.length) {
    return resolveTiedGroup(
      entryIds,
      aggs,
      matches,
      criteria,
      criterionIndex,
      special,
      traces,
    );
  }

  const criterion = criteria[criterionIndex]!;

  if (criterion === "HEAD_TO_HEAD" || criterion === "DRAW_REQUIRED") {
    return resolveTiedGroup(
      entryIds,
      aggs,
      matches,
      criteria,
      criterionIndex,
      special,
      traces,
    );
  }

  const sorted = [...entryIds].sort((a, b) => {
    const cmp = compareMetric(
      criterion,
      aggs.get(a)!,
      aggs.get(b)!,
      miniAggs,
    );
    if (cmp !== 0) return cmp;
    return a.localeCompare(b);
  });

  for (const id of sorted) {
    const steps = traces.get(id) ?? [];
    steps.push({
      criterion,
      groupEntryIds: [...entryIds].sort(),
      value: String(metricValue(criterion, aggs.get(id)!, miniAggs)),
    });
    traces.set(id, steps);
  }

  const groups: string[][] = [];
  let current: string[] = [];
  let currentKey: string | null = null;

  for (const id of sorted) {
    const key = String(metricValue(criterion, aggs.get(id)!, miniAggs));
    if (currentKey === null || key === currentKey) {
      current.push(id);
      currentKey = key;
    } else {
      groups.push(current);
      current = [id];
      currentKey = key;
    }
  }
  if (current.length > 0) groups.push(current);

  const result: RankedUnit[] = [];
  for (const group of groups) {
    if (group.length === 1) {
      result.push({ entryIds: group });
    } else {
      result.push(
        ...resolveTiedGroup(
          group,
          aggs,
          matches,
          criteria,
          criterionIndex + 1,
          special,
          traces,
        ),
      );
    }
  }
  return result;
}

/**
 * Calculates group standings with configurable tie-break criteria.
 * Result order is independent of input entry/match order.
 */
export function calculateStandings(
  input: CalculateStandingsInput,
): StandingRow[] {
  const parsed = calculateStandingsInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(
      StandingsErrorCode.INVALID_INPUT,
      `Invalid calculateStandings input: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    );
  }

  const { entries, matches, rule } = parsed.data as CalculateStandingsInput;
  const special = rule.specialPolicy ?? DEFAULT_SPECIAL_POLICY;

  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      throw new DomainError(
        StandingsErrorCode.DUPLICATE_ENTRY,
        `Duplicate entry: ${entry.id}`,
      );
    }
    seen.add(entry.id);
  }

  const aggs = new Map<string, Agg>();
  for (const entry of entries) {
    aggs.set(entry.id, emptyAgg(entry.id));
  }

  // Process matches in stable id order so aggregation is order-independent.
  const orderedMatches = [...matches].sort((a, b) => a.id.localeCompare(b.id));
  for (const match of orderedMatches) {
    if (match.entryAId === match.entryBId) {
      throw new DomainError(
        StandingsErrorCode.INVALID_MATCH,
        `Match ${match.id} has identical participants.`,
      );
    }
    applyCompletedMatch(aggs, match, special);
  }

  const traces = new Map<string, TieBreakStep[]>();
  const entryIds = [...aggs.keys()].sort((a, b) => a.localeCompare(b));

  const ranked = partitionByCriteria(
    entryIds,
    aggs,
    orderedMatches,
    rule.criteria,
    0,
    special,
    traces,
    null,
  );

  const rows: StandingRow[] = [];
  let rank = 1;

  for (const unit of ranked) {
    const sortedUnit = [...unit.entryIds].sort((a, b) => a.localeCompare(b));
    for (const entryId of sortedUnit) {
      const agg = aggs.get(entryId)!;
      rows.push({
        entryId,
        rank,
        played: agg.played,
        wins: agg.wins,
        losses: agg.losses,
        setsWon: agg.setsWon,
        setsLost: agg.setsLost,
        setDifference: agg.setsWon - agg.setsLost,
        pointsWon: agg.pointsWon,
        pointsLost: agg.pointsLost,
        pointDifference: agg.pointsWon - agg.pointsLost,
        tieBreakTrace: traces.get(entryId) ?? [],
        ...(unit.drawRequired ? { drawRequired: true } : {}),
      });
    }
    rank += sortedUnit.length;
  }

  return rows;
}

/** Helper for callers that want the default rule. */
export function defaultStandingRule(
  overrides: Partial<StandingRule> = {},
): StandingRule {
  return {
    criteria: overrides.criteria ?? [
      "MATCH_WINS",
      "HEAD_TO_HEAD",
      "SET_DIFFERENCE",
      "POINT_DIFFERENCE",
      "POINTS_WON",
      "ENTRY_ID",
    ],
    specialPolicy: overrides.specialPolicy,
  };
}
