import { DomainStateError } from "@/application/errors";
import type {
  EventStatus,
  MatchStatus,
  StageStatus,
  TournamentStatus,
} from "./types";

/** Forward-only tournament transitions (plan §8.1). Archive is an admin side-step. */
const TOURNAMENT_FORWARD: Record<TournamentStatus, TournamentStatus[]> = {
  DRAFT: ["REGISTRATION"],
  REGISTRATION: ["DRAW"],
  DRAW: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  ARCHIVED: [],
};

const EVENT_FORWARD: Record<EventStatus, EventStatus[]> = {
  SETUP: ["DRAW_READY"],
  DRAW_READY: ["DRAW_CONFIRMED"],
  DRAW_CONFIRMED: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
};

const STAGE_FORWARD: Record<StageStatus, StageStatus[]> = {
  PENDING: ["ACTIVE"],
  ACTIVE: ["COMPLETED"],
  COMPLETED: [],
};

export function canTransitionTournament(
  from: TournamentStatus,
  to: TournamentStatus,
): boolean {
  if (from === to) {
    return false;
  }
  if (to === "ARCHIVED") {
    return from !== "ARCHIVED";
  }
  return TOURNAMENT_FORWARD[from].includes(to);
}

export function assertTournamentTransition(
  from: TournamentStatus,
  to: TournamentStatus,
): void {
  if (!canTransitionTournament(from, to)) {
    throw new DomainStateError(
      `Invalid tournament transition: ${from} → ${to}`,
      "INVALID_TOURNAMENT_TRANSITION",
    );
  }
}

export function canTransitionEvent(from: EventStatus, to: EventStatus): boolean {
  if (from === to) {
    return false;
  }
  return EVENT_FORWARD[from].includes(to);
}

export function assertEventTransition(from: EventStatus, to: EventStatus): void {
  if (!canTransitionEvent(from, to)) {
    throw new DomainStateError(
      `Invalid event transition: ${from} → ${to}`,
      "INVALID_EVENT_TRANSITION",
    );
  }
}

export function canTransitionStage(from: StageStatus, to: StageStatus): boolean {
  if (from === to) {
    return false;
  }
  return STAGE_FORWARD[from].includes(to);
}

export function assertStageTransition(from: StageStatus, to: StageStatus): void {
  if (!canTransitionStage(from, to)) {
    throw new DomainStateError(
      `Invalid stage transition: ${from} → ${to}`,
      "INVALID_STAGE_TRANSITION",
    );
  }
}

/** Setup mutations (stages, rules, event fields that reshape the pipeline) require SETUP. */
export function assertEventMutable(status: EventStatus): void {
  if (status !== "SETUP") {
    throw new DomainStateError(
      `Event is ${status}; setup changes are only allowed in SETUP`,
      "EVENT_NOT_MUTABLE",
    );
  }
}

export function assertTournamentNotArchived(status: TournamentStatus): void {
  if (status === "ARCHIVED") {
    throw new DomainStateError(
      "Tournament is archived and cannot be modified",
      "TOURNAMENT_ARCHIVED",
    );
  }
}

const MATCH_STARTABLE: MatchStatus[] = ["PENDING", "SCHEDULED"];
const MATCH_SCOREABLE: MatchStatus[] = ["IN_PROGRESS"];
const MATCH_TERMINAL: MatchStatus[] = [
  "COMPLETED",
  "WALKOVER",
  "CANCELLED",
];
const MATCH_CORRECTABLE: MatchStatus[] = ["COMPLETED", "WALKOVER"];
const MATCH_CANCELLABLE: MatchStatus[] = [
  "PENDING",
  "SCHEDULED",
  "IN_PROGRESS",
];

export function assertMatchStartable(status: MatchStatus): void {
  if (!MATCH_STARTABLE.includes(status)) {
    throw new DomainStateError(
      `Match cannot be started from ${status}`,
      "MATCH_NOT_STARTABLE",
    );
  }
}

export function assertMatchScoreable(status: MatchStatus): void {
  if (!MATCH_SCOREABLE.includes(status)) {
    throw new DomainStateError(
      `Match cannot accept scores in ${status}`,
      "MATCH_NOT_SCOREABLE",
    );
  }
}

export function assertMatchCorrectable(status: MatchStatus): void {
  if (!MATCH_CORRECTABLE.includes(status)) {
    throw new DomainStateError(
      `Match score cannot be corrected in ${status}`,
      "MATCH_NOT_CORRECTABLE",
    );
  }
}

export function assertMatchCancellable(status: MatchStatus): void {
  if (!MATCH_CANCELLABLE.includes(status)) {
    throw new DomainStateError(
      `Match cannot be cancelled from ${status}`,
      "MATCH_NOT_CANCELLABLE",
    );
  }
}

export function isMatchTerminal(status: MatchStatus): boolean {
  return MATCH_TERMINAL.includes(status);
}
