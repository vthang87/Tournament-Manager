import { describe, expect, it } from "vitest";
import { canPerform, type PolicyAction } from "@/lib/auth/policies";
import {
  createManagedUserSchema,
  updateManagedUserSchema,
} from "@/lib/validation/schemas";

describe("Super Admin user management", () => {
  it("allows Super Admin to perform every platform operation", () => {
    const actions: PolicyAction[] = [
      "setup",
      "import",
      "draw",
      "schedule",
      "score",
      "correct",
      "archive",
      "view",
    ];
    expect(actions.every((action) => canPerform("SUPER_ADMIN", action))).toBe(
      true,
    );
  });

  it("validates managed account credentials and roles", () => {
    expect(
      createManagedUserSchema.safeParse({
        username: "operator.one",
        displayName: "Operator One",
        password: "secure-pass-123",
        role: "OPERATOR",
        active: true,
      }).success,
    ).toBe(true);

    expect(
      createManagedUserSchema.safeParse({
        username: "Invalid User",
        displayName: "Invalid",
        password: "short",
        role: "VIEWER",
      }).success,
    ).toBe(false);

    expect(
      updateManagedUserSchema.safeParse({
        username: "platform.admin",
        displayName: "Platform Admin",
        role: "SUPER_ADMIN",
        active: true,
      }).success,
    ).toBe(true);
  });
});
