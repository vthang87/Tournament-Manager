import type { MatchRuleSnapshot } from "@/core/tournament-engine/match-rules/types";
import { createMatchRuleSnapshot } from "@/core/tournament-engine/match-rules/create-snapshot";

export function parseRuleSnapshot(json: string): MatchRuleSnapshot {
  return createMatchRuleSnapshot(JSON.parse(json) as MatchRuleSnapshot);
}

export function formatRuleSummary(rule: MatchRuleSnapshot): string {
  const name = rule.name ? `${rule.name} · ` : "";
  const deciding =
    rule.decidingSetPoints != null
      ? ` · deciding ${rule.decidingSetPoints}`
      : "";
  return `${name}best of ${rule.bestOfSets} · ${rule.pointsToWin} pts (win by ${rule.winBy}, max ${rule.maxPoints})${deciding}`;
}

export function entryLabel(
  entryId: string | null | undefined,
  labels: Map<string, string>,
): string {
  if (!entryId) {
    return "TBD";
  }
  return labels.get(entryId) ?? entryId.slice(0, 8);
}

export function scoreLine(
  sets: Array<{ scoreA: number; scoreB: number }>,
): string {
  if (sets.length === 0) {
    return "—";
  }
  return sets.map((s) => `${s.scoreA}–${s.scoreB}`).join(", ");
}
