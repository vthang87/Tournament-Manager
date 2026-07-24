import type { UserRole } from "@/core/domain";
import { ForbiddenError } from "@/application/errors";

/**
 * Permission actions mapped to plan §8.4.
 * Correcting completed results: Admin always; Operator per policy (allowed in V1).
 */
export type PolicyAction =
  | "setup"
  | "import"
  | "draw"
  | "schedule"
  | "score"
  | "correct"
  | "archive"
  | "view";

const ROLE_MATRIX: Record<PolicyAction, readonly UserRole[]> = {
  setup: ["ADMIN"],
  import: ["ADMIN", "OPERATOR"],
  draw: ["ADMIN", "OPERATOR"],
  schedule: ["ADMIN", "OPERATOR"],
  score: ["ADMIN", "OPERATOR", "SCOREKEEPER"],
  correct: ["ADMIN", "OPERATOR"],
  archive: ["ADMIN"],
  view: ["ADMIN", "OPERATOR", "SCOREKEEPER", "VIEWER"],
};

export function rolesForAction(action: PolicyAction): readonly UserRole[] {
  return ROLE_MATRIX[action];
}

export function canPerform(role: UserRole, action: PolicyAction): boolean {
  return ROLE_MATRIX[action].includes(role);
}

export function assertCanPerform(role: UserRole, action: PolicyAction): void {
  if (!canPerform(role, action)) {
    throw new ForbiddenError(`Role ${role} cannot perform ${action}`);
  }
}

export function roleAllowsAny(
  role: UserRole,
  actions: PolicyAction[],
): boolean {
  return actions.some((action) => canPerform(role, action));
}
