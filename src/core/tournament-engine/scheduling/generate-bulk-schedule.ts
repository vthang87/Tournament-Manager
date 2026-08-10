import { DomainError } from "@/core/tournament-engine/errors";
import { SchedulingErrorCode } from "./errors";
import { addMinutesIso } from "./intervals";
import type { ScheduleAssignment, ScheduleMatch } from "./types";

export type GenerateBulkScheduleInput = {
  matches: ScheduleMatch[];
  matchIds: string[];
  courtIds: string[];
  startTime: string;
  slotMinutes: number;
  entryPlayerIds?: Record<string, string[]>;
};

function participantKeys(
  match: ScheduleMatch,
  entryPlayerIds?: Record<string, string[]>,
): Set<string> {
  const keys = new Set<string>();
  for (const entryId of [match.entryAId, match.entryBId]) {
    if (!entryId) continue;
    keys.add(`entry:${entryId}`);
    for (const playerId of entryPlayerIds?.[entryId] ?? []) {
      keys.add(`player:${playerId}`);
    }
  }
  return keys;
}

function intersects(left: Set<string>, right: Set<string>): boolean {
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
}

/**
 * Fills active courts in parallel waves while keeping the same entry/player
 * out of simultaneous and immediately consecutive waves. Input order remains
 * the scheduling priority.
 */
export function generateBulkSchedule(
  input: GenerateBulkScheduleInput,
): ScheduleAssignment[] {
  if (input.courtIds.length === 0) {
    throw new DomainError(
      SchedulingErrorCode.INVALID_INPUT,
      "Bulk scheduling requires at least one court.",
    );
  }

  const matchById = new Map(input.matches.map((match) => [match.id, match]));
  const seen = new Set<string>();
  const pending = input.matchIds.map((matchId) => {
    if (seen.has(matchId)) {
      throw new DomainError(
        SchedulingErrorCode.INVALID_INPUT,
        `Duplicate match in bulk schedule: ${matchId}`,
      );
    }
    seen.add(matchId);
    const match = matchById.get(matchId);
    if (!match) {
      throw new DomainError(
        SchedulingErrorCode.UNKNOWN_MATCH,
        `Unknown match in bulk schedule: ${matchId}`,
      );
    }
    return match;
  });

  const assignments: ScheduleAssignment[] = [];
  let waveStart = input.startTime;
  let previousWaveParticipants = new Set<string>();

  while (pending.length > 0) {
    const wave: ScheduleMatch[] = [];
    const occupiedParticipants = new Set<string>();

    for (
      let index = 0;
      index < pending.length && wave.length < input.courtIds.length;

    ) {
      const match = pending[index]!;
      const participants = participantKeys(match, input.entryPlayerIds);
      if (
        intersects(participants, occupiedParticipants) ||
        intersects(participants, previousWaveParticipants)
      ) {
        index += 1;
        continue;
      }
      wave.push(match);
      pending.splice(index, 1);
      for (const participant of participants) {
        occupiedParticipants.add(participant);
      }
    }

    if (wave.length === 0) {
      waveStart = addMinutesIso(
        waveStart,
        input.slotMinutes,
      );
      previousWaveParticipants = new Set();
      continue;
    }

    wave.forEach((match, index) => {
      assignments.push({
        matchId: match.id,
        courtId: input.courtIds[index]!,
        startTime: waveStart,
      });
    });
    waveStart = addMinutesIso(waveStart, input.slotMinutes);
    previousWaveParticipants = occupiedParticipants;
  }

  return assignments;
}
