import { describe, expect, it } from "vitest";
import {
  assertTournamentTransition,
  assertEventTransition,
  assertStageTransition,
  canTransitionTournament,
} from "@/core/domain/state-machines";
import { DomainStateError } from "@/application/errors";

describe("state machines", () => {
  it("allows forward tournament flow and archive", () => {
    expect(canTransitionTournament("DRAFT", "REGISTRATION")).toBe(true);
    expect(canTransitionTournament("DRAFT", "IN_PROGRESS")).toBe(false);
    expect(canTransitionTournament("COMPLETED", "ARCHIVED")).toBe(true);
    expect(() =>
      assertTournamentTransition("ARCHIVED", "DRAFT"),
    ).toThrow(DomainStateError);
  });

  it("allows event and stage forward-only transitions", () => {
    expect(() => assertEventTransition("SETUP", "DRAW_READY")).not.toThrow();
    expect(() =>
      assertEventTransition("SETUP", "COMPLETED"),
    ).toThrow(DomainStateError);
    expect(() => assertStageTransition("PENDING", "ACTIVE")).not.toThrow();
    expect(() =>
      assertStageTransition("COMPLETED", "ACTIVE"),
    ).toThrow(DomainStateError);
  });
});
