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
  setup: ["SUPER_ADMIN", "ADMIN"],
  import: ["SUPER_ADMIN", "ADMIN", "OPERATOR"],
  draw: ["SUPER_ADMIN", "ADMIN", "OPERATOR"],
  schedule: ["SUPER_ADMIN", "ADMIN", "OPERATOR"],
  score: ["SUPER_ADMIN", "ADMIN", "OPERATOR", "SCOREKEEPER"],
  correct: ["SUPER_ADMIN", "ADMIN", "OPERATOR"],
  archive: ["SUPER_ADMIN", "ADMIN"],
  view: ["SUPER_ADMIN", "ADMIN", "OPERATOR", "SCOREKEEPER", "VIEWER"],
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
