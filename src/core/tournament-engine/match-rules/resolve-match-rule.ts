import { DomainError } from "@/core/tournament-engine/errors";
import { createMatchRuleSnapshot } from "./create-snapshot";
import { MatchRuleErrorCode } from "./errors";
import type { MatchRuleSnapshot, ResolveMatchRuleInput } from "./types";

/**
 * Resolve the rule a match should use.
 * Priority: match override/snapshot → stage rule → event default.
 */
export function resolveMatchRule(
  input: ResolveMatchRuleInput,
): MatchRuleSnapshot {
  const source =
    input.matchOverride ?? input.stageRule ?? input.eventDefaultRule ?? null;

  if (!source) {
    throw new DomainError(
      MatchRuleErrorCode.RULE_NOT_RESOLVABLE,
      "No match rule available: provide match override, stage rule, or event default.",
    );
  }

  return createMatchRuleSnapshot(source);
}
