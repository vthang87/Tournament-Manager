import type { MatchRuleSnapshot } from "@/core/tournament-engine/match-rules/types";
import { createMatchRuleSnapshot } from "@/core/tournament-engine/match-rules/create-snapshot";

export function parseRuleSnapshot(json: string): MatchRuleSnapshot {
  return createMatchRuleSnapshot(JSON.parse(json) as MatchRuleSnapshot);
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

const KNOWN_RULE_NAMES: Record<string, string> = {
  "Group Stage — Best of 1 (21)": "ruleName.groupBo1_21",
  "Vòng bảng — Best of 1 (21)": "ruleName.groupBo1_21",
  "Knockout — Best of 3 (15)": "ruleName.knockoutBo3_15",
  "Final — Best of 3 (21)": "ruleName.finalBo3_21",
  "Chung kết — Best of 3 (21)": "ruleName.finalBo3_21",
  "Tiêu chuẩn — Best of 3 (21)": "ruleName.standardBo3_21",
  "Knockout — Best of 3 (21)": "ruleName.knockoutBo3_21",
};

export function localizeRuleName(
  name: string | null | undefined,
  t: Translate,
): string | null {
  if (!name) {
    return null;
  }
  const key = KNOWN_RULE_NAMES[name];
  return key ? t(key) : name;
}

export function formatRuleSummary(
  rule: MatchRuleSnapshot,
  t: Translate,
): string {
  const localizedName = localizeRuleName(rule.name, t);
  const name = localizedName ? `${localizedName} · ` : "";
  const deciding =
    rule.decidingSetPoints != null
      ? t("ruleSummaryDeciding", { points: rule.decidingSetPoints })
      : "";
  return `${name}${t("ruleSummaryBody", {
    bestOf: rule.bestOfSets,
    points: rule.pointsToWin,
    winBy: rule.winBy,
    max: rule.maxPoints,
  })}${deciding}`;
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
