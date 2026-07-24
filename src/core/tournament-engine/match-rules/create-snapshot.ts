import { DomainError } from "@/core/tournament-engine/errors";
import { MatchRuleErrorCode } from "./errors";
import { matchRuleSnapshotSchema } from "./schemas";
import type { MatchRule, MatchRuleSnapshot } from "./types";

type SnapshotSource = MatchRule | MatchRuleSnapshot;

/**
 * Creates an immutable plain-object snapshot with no mutable DB references.
 * Mutating the source after creation must not affect the returned snapshot.
 */
export function createMatchRuleSnapshot(
  rule: SnapshotSource,
): MatchRuleSnapshot {
  const parsed = matchRuleSnapshotSchema.safeParse({
    bestOfSets: rule.bestOfSets,
    pointsToWin: rule.pointsToWin,
    winBy: rule.winBy,
    maxPoints: rule.maxPoints,
    deuceEnabled: rule.deuceEnabled,
    decidingSetPoints: rule.decidingSetPoints,
    decidingSetWinBy: rule.decidingSetWinBy,
    decidingSetMaxPoints: rule.decidingSetMaxPoints,
    changeEndsEnabled: rule.changeEndsEnabled,
    changeEndsAt: rule.changeEndsAt,
    name: "name" in rule ? rule.name : undefined,
  });

  if (!parsed.success) {
    const code =
      parsed.error.issues[0]?.message ?? MatchRuleErrorCode.INVALID_RULE;
    throw new DomainError(
      Object.values(MatchRuleErrorCode).includes(code as MatchRuleErrorCode)
        ? (code as MatchRuleErrorCode)
        : MatchRuleErrorCode.INVALID_RULE,
      `Invalid match rule for snapshot: ${parsed.error.message}`,
    );
  }

  const snapshot: MatchRuleSnapshot = {
    bestOfSets: parsed.data.bestOfSets,
    pointsToWin: parsed.data.pointsToWin,
    winBy: parsed.data.winBy,
    maxPoints: parsed.data.maxPoints,
    deuceEnabled: parsed.data.deuceEnabled,
    decidingSetPoints: parsed.data.decidingSetPoints,
    decidingSetWinBy: parsed.data.decidingSetWinBy,
    decidingSetMaxPoints: parsed.data.decidingSetMaxPoints,
    changeEndsEnabled: parsed.data.changeEndsEnabled,
    changeEndsAt: parsed.data.changeEndsAt,
  };

  if (parsed.data.name !== undefined) {
    snapshot.name = parsed.data.name;
  }

  return snapshot;
}
