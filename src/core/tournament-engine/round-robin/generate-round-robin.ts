import { DomainError } from "@/core/tournament-engine/errors";
import { RoundRobinErrorCode } from "./errors";
import { generateRoundRobinInputSchema } from "./schemas";
import type {
  GenerateRoundRobinInput,
  RoundRobinPair,
  RoundRobinRound,
} from "./types";

const BYE = Symbol("BYE");

type Slot = string | typeof BYE;

/**
 * Circle method round-robin schedule.
 * Odd entry counts use an internal BYE that is never emitted as a match.
 *
 * Guarantees:
 * - each unordered pair appears exactly once
 * - no entry appears twice in the same round
 * - total matches = n(n-1)/2
 */
export function generateRoundRobin(
  input: GenerateRoundRobinInput,
): RoundRobinRound[] {
  const parsed = generateRoundRobinInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(
      RoundRobinErrorCode.INVALID_INPUT,
      `Invalid generateRoundRobin input: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    );
  }

  const entryIds = parsed.data.entryIds;
  const seen = new Set<string>();
  for (const id of entryIds) {
    if (seen.has(id)) {
      throw new DomainError(
        RoundRobinErrorCode.DUPLICATE_ENTRY,
        `Duplicate entry id: ${id}`,
      );
    }
    seen.add(id);
  }

  if (entryIds.length < 2) {
    throw new DomainError(
      RoundRobinErrorCode.TOO_FEW_ENTRIES,
      "Need at least 2 entries for round robin.",
    );
  }

  // Preserve caller order; circle method is deterministic given order.
  const slots: Slot[] = [...entryIds];
  if (slots.length % 2 === 1) {
    slots.push(BYE);
  }

  const n = slots.length;
  const roundCount = n - 1;
  const half = n / 2;
  const rounds: RoundRobinRound[] = [];

  // Working circle: index 0 is fixed; rotate the rest.
  const circle = [...slots];

  for (let round = 0; round < roundCount; round += 1) {
    const pairs: RoundRobinPair[] = [];

    for (let i = 0; i < half; i += 1) {
      const a = circle[i]!;
      const b = circle[n - 1 - i]!;
      if (a === BYE || b === BYE) continue;
      // Deterministic side order by id for stable output.
      if (a < b) {
        pairs.push({ entryAId: a, entryBId: b });
      } else {
        pairs.push({ entryAId: b, entryBId: a });
      }
    }

    // Stable pair order within the round.
    pairs.sort(
      (left, right) =>
        left.entryAId.localeCompare(right.entryAId) ||
        left.entryBId.localeCompare(right.entryBId),
    );

    rounds.push({ roundNumber: round + 1, pairs });

    // Rotate: keep index 0 fixed, move last element to index 1.
    const last = circle.pop()!;
    circle.splice(1, 0, last);
  }

  return rounds;
}
