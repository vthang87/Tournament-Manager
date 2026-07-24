import { resolveMatchRule } from "@/core/tournament-engine/match-rules";
import type { MatchRule } from "@/core/tournament-engine/match-rules/types";
import type { Stage } from "./types";

export type PipelineStageView = Stage & {
  matchRuleId: string | null;
};

export type PipelineValidationResult = {
  ok: boolean;
  errors: string[];
};

/**
 * Validates stage pipeline: unique orderIndex, ordered contiguous optional,
 * and every stage has a resolvable match rule (stage rule or event default).
 */
export function validateStagePipeline(
  stages: PipelineStageView[],
  eventDefaultRule: MatchRule | null,
  rulesById: Map<string, MatchRule>,
): PipelineValidationResult {
  const errors: string[] = [];

  if (stages.length === 0) {
    errors.push("Pipeline requires at least one stage");
    return { ok: false, errors };
  }

  const orders = stages.map((s) => s.orderIndex);
  if (new Set(orders).size !== orders.length) {
    errors.push("Stage orderIndex values must be unique");
  }

  const sorted = [...stages].sort((a, b) => a.orderIndex - b.orderIndex);
  for (let i = 0; i < sorted.length; i++) {
    const stage = sorted[i]!;
    const stageRule = stage.matchRuleId
      ? (rulesById.get(stage.matchRuleId) ?? null)
      : null;

    try {
      resolveMatchRule({
        stageRule,
        eventDefaultRule,
      });
    } catch {
      errors.push(
        `Stage "${stage.name}" (${stage.id}) has no resolvable match rule`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}
