import { DomainError } from "@/core/tournament-engine/errors";
import type { EngineWarning } from "@/core/tournament-engine/types";
import { BracketErrorCode } from "./errors";
import {
  autoAdvanceByes,
  placeLoserIntoNext,
  placeWinnerIntoNext,
} from "./generate-bracket";
import { completedBracketMatchSchema } from "./schemas";
import type { AdvanceWinnerInput, Bracket, BracketUpdate } from "./types";

function cloneBracket(bracket: Bracket): Bracket {
  return {
    ...bracket,
    matches: bracket.matches.map((match) => ({
      ...match,
      slotA: { ...match.slotA },
      slotB: { ...match.slotB },
    })),
  };
}

/**
 * Advances a completed match winner into the next slot.
 * Idempotent: repeating the same completion does not duplicate or corrupt slots.
 */
export function advanceWinner(input: AdvanceWinnerInput): BracketUpdate {
  const parsed = completedBracketMatchSchema.safeParse(input.completedMatch);
  if (!parsed.success) {
    throw new DomainError(
      BracketErrorCode.INVALID_INPUT,
      `Invalid completedMatch: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    );
  }

  const { matchId, winnerEntryId } = parsed.data;
  const warnings: EngineWarning[] = [];
  const bracket = cloneBracket(input.bracket);

  const match = bracket.matches.find((row) => row.id === matchId);
  if (!match) {
    throw new DomainError(
      BracketErrorCode.UNKNOWN_MATCH,
      `Unknown match: ${matchId}`,
    );
  }

  const participants = [match.slotA.entryId, match.slotB.entryId].filter(
    (id): id is string => Boolean(id),
  );

  if (!participants.includes(winnerEntryId)) {
    throw new DomainError(
      BracketErrorCode.INVALID_WINNER,
      `Winner ${winnerEntryId} is not a participant of ${matchId}.`,
    );
  }

  // Idempotent short-circuit: already advanced with same winner.
  if (match.winnerEntryId === winnerEntryId) {
    placeWinnerIntoNext(bracket, match, winnerEntryId);
    const loserEntryId = participants.find((id) => id !== winnerEntryId);
    if (loserEntryId) {
      placeLoserIntoNext(bracket, match, loserEntryId);
    }
    return { bracket: autoAdvanceByes(bracket), warnings };
  }

  if (match.winnerEntryId && match.winnerEntryId !== winnerEntryId) {
    throw new DomainError(
      BracketErrorCode.INVALID_WINNER,
      `Match ${matchId} already has winner ${match.winnerEntryId}.`,
    );
  }

  if (!match.slotA.entryId || !match.slotB.entryId) {
    // Allow completion only when both sides filled (BYE already auto-advanced).
    if (match.slotA.isBye || match.slotB.isBye) {
      throw new DomainError(
        BracketErrorCode.MATCH_NOT_COMPLETED,
        `Match ${matchId} still has an unresolved BYE slot.`,
      );
    }
  }

  match.winnerEntryId = winnerEntryId;
  placeWinnerIntoNext(bracket, match, winnerEntryId);

  const loserEntryId = participants.find((id) => id !== winnerEntryId);
  if (loserEntryId) {
    placeLoserIntoNext(bracket, match, loserEntryId);
  }

  return { bracket: autoAdvanceByes(bracket), warnings };
}
