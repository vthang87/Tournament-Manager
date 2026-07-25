import { DomainError } from "@/core/tournament-engine/errors";
import type { Qualifier } from "@/core/tournament-engine/qualification/types";
import type { EngineResult, EngineWarning } from "@/core/tournament-engine/types";
import { BracketErrorCode } from "./errors";
import { generateBracketInputSchema } from "./schemas";
import type {
  Bracket,
  BracketMatch,
  BracketMatchSlot,
  ByeAssignment,
  GenerateBracketInput,
} from "./types";

function isPowerOfTwo(value: number): boolean {
  return value >= 2 && (value & (value - 1)) === 0;
}

/**
 * Returns seed numbers (1-based) for each bracket slot left-to-right.
 * Adjacent slots form R1 pairings: (0,1), (2,3), ...
 */
export function seedingOrder(bracketSize: number): number[] {
  if (bracketSize === 1) return [1];
  const half = seedingOrder(bracketSize / 2);
  const result: number[] = [];
  for (const seed of half) {
    result.push(seed);
    result.push(bracketSize + 1 - seed);
  }
  return result;
}

function emptySlot(): BracketMatchSlot {
  return { entryId: null, isBye: false };
}

function byeSlot(): BracketMatchSlot {
  return { entryId: null, isBye: true };
}

function qualifierSlot(qualifier: Qualifier): BracketMatchSlot {
  return {
    entryId: qualifier.entryId,
    isBye: false,
    sourceGroupId: qualifier.sourceGroupId,
    sourceRank: qualifier.sourceRank,
    qualificationSeed: qualifier.qualificationSeed,
  };
}

function buildMatchSkeleton(
  bracketSize: number,
  thirdPlaceEnabled: boolean,
): BracketMatch[] {
  const roundCount = Math.log2(bracketSize);
  const matches: BracketMatch[] = [];

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    const matchCount = bracketSize / 2 ** (roundIndex + 1);
    for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
      const id = `R${roundIndex}-M${matchIndex}`;
      const isFinal = roundIndex === roundCount - 1;
      let nextMatchId: string | null = null;
      let nextMatchSlot: "A" | "B" | null = null;

      if (!isFinal) {
        nextMatchId = `R${roundIndex + 1}-M${Math.floor(matchIndex / 2)}`;
        nextMatchSlot = matchIndex % 2 === 0 ? "A" : "B";
      }

      matches.push({
        id,
        roundIndex,
        matchIndex,
        slotA: emptySlot(),
        slotB: emptySlot(),
        winnerEntryId: null,
        nextMatchId,
        nextMatchSlot,
        loserNextMatchId: null,
        loserNextMatchSlot: null,
        isThirdPlace: false,
      });
    }
  }

  if (thirdPlaceEnabled && roundCount >= 2) {
    const sfRound = roundCount - 2;
    const sf0 = matches.find(
      (match) => match.roundIndex === sfRound && match.matchIndex === 0,
    );
    const sf1 = matches.find(
      (match) => match.roundIndex === sfRound && match.matchIndex === 1,
    );

    matches.push({
      id: "TP-M0",
      roundIndex: roundCount - 1,
      matchIndex: 0,
      slotA: emptySlot(),
      slotB: emptySlot(),
      winnerEntryId: null,
      nextMatchId: null,
      nextMatchSlot: null,
      loserNextMatchId: null,
      loserNextMatchSlot: null,
      isThirdPlace: true,
    });

    if (sf0) {
      sf0.loserNextMatchId = "TP-M0";
      sf0.loserNextMatchSlot = "A";
    }
    if (sf1) {
      sf1.loserNextMatchId = "TP-M0";
      sf1.loserNextMatchSlot = "B";
    }
  }

  return matches;
}

function placeByQualificationSeed(
  slots: Array<BracketMatchSlot | null>,
  qualifiers: Qualifier[],
  bracketSize: number,
  byeAssignment: ByeAssignment,
): void {
  const order = seedingOrder(bracketSize);
  const bySeed = new Map(
    qualifiers.map((qualifier) => [qualifier.qualificationSeed, qualifier]),
  );

  // Which seed numbers get real players vs BYE.
  const activeSeeds = new Set(
    [...bySeed.keys()].sort((a, b) => a - b),
  );

  // TOP_SEEDS: seeds 1..q placed; remaining high seed numbers vacant → BYE.
  // BOTTOM_SEEDS: place lowest seeds first into high seed-number slots;
  //               top seed slots get BYE (rarely used; still supported).
  const seedNumbers = Array.from({ length: bracketSize }, (_, i) => i + 1);
  let placedSeeds: number[];

  if (byeAssignment === "TOP_SEEDS") {
    placedSeeds = seedNumbers.filter((seed) => activeSeeds.has(seed));
  } else {
    // Map qualifiers onto the highest seed numbers (bottom of bracket).
    const sortedQualifiers = [...qualifiers].sort(
      (a, b) => a.qualificationSeed - b.qualificationSeed,
    );
    const targetSeeds = seedNumbers.slice(-sortedQualifiers.length);
    placedSeeds = [];
    for (let i = 0; i < sortedQualifiers.length; i += 1) {
      const target = targetSeeds[i]!;
      bySeed.set(target, sortedQualifiers[i]!);
      placedSeeds.push(target);
    }
  }

  const placedSet = new Set(placedSeeds);

  for (let position = 0; position < bracketSize; position += 1) {
    const seedNumber = order[position]!;
    if (placedSet.has(seedNumber) && bySeed.has(seedNumber)) {
      slots[position] = qualifierSlot(bySeed.get(seedNumber)!);
    } else {
      slots[position] = byeSlot();
    }
  }
}

function placeStandardGroupCross(
  slots: Array<BracketMatchSlot | null>,
  qualifiers: Qualifier[],
  bracketSize: number,
): EngineWarning[] {
  // Fall back to seed placement first, then try same-group swaps below.
  placeByQualificationSeed(slots, qualifiers, bracketSize, "TOP_SEEDS");
  return [];
}

function slotsToRoundOne(matches: BracketMatch[], slots: BracketMatchSlot[]): void {
  const r1 = matches
    .filter((match) => match.roundIndex === 0 && !match.isThirdPlace)
    .sort((a, b) => a.matchIndex - b.matchIndex);

  for (let i = 0; i < r1.length; i += 1) {
    const match = r1[i]!;
    match.slotA = slots[i * 2]!;
    match.slotB = slots[i * 2 + 1]!;
  }
}

function sameGroupRematch(match: BracketMatch): boolean {
  const a = match.slotA.sourceGroupId;
  const b = match.slotB.sourceGroupId;
  return (
    Boolean(a) &&
    Boolean(b) &&
    a === b &&
    !match.slotA.isBye &&
    !match.slotB.isBye
  );
}

/**
 * Attempt to eliminate R1 same-group rematches by swapping slot B entries
 * among R1 matches. Deterministic: try swaps in match-index order.
 */
function resolveSameGroupRematches(matches: BracketMatch[]): EngineWarning[] {
  const warnings: EngineWarning[] = [];
  const r1 = matches
    .filter((match) => match.roundIndex === 0 && !match.isThirdPlace)
    .sort((a, b) => a.matchIndex - b.matchIndex);

  for (let i = 0; i < r1.length; i += 1) {
    const match = r1[i]!;
    if (!sameGroupRematch(match)) continue;
    if (match.slotB.isBye || match.slotA.isBye) continue;

    let swapped = false;
    for (let j = i + 1; j < r1.length; j += 1) {
      const other = r1[j]!;
      if (other.slotB.isBye || !other.slotB.entryId) continue;

      // Swap B slots and check both matches improve / don't create new rematch.
      const originalB = match.slotB;
      const otherB = other.slotB;
      match.slotB = otherB;
      other.slotB = originalB;

      const stillBad =
        sameGroupRematch(match) || sameGroupRematch(other);
      if (!stillBad) {
        swapped = true;
        break;
      }

      // Revert.
      match.slotB = originalB;
      other.slotB = otherB;
    }

    if (!swapped && sameGroupRematch(match)) {
      warnings.push({
        code: "BRACKET_SAME_GROUP_R1",
        message: `Could not avoid same-group rematch in ${match.id} (${match.slotA.sourceGroupId}).`,
        entityIds: [
          match.slotA.entryId,
          match.slotB.entryId,
        ].filter((id): id is string => Boolean(id)),
      });
    }
  }

  return warnings;
}

/**
 * Auto-advance BYE matches idempotently.
 */
export function autoAdvanceByes(bracket: Bracket): Bracket {
  let changed = true;
  const clone: Bracket = {
    ...bracket,
    matches: bracket.matches.map((match) => ({
      ...match,
      slotA: { ...match.slotA },
      slotB: { ...match.slotB },
    })),
  };

  while (changed) {
    changed = false;
    for (const match of clone.matches) {
      if (match.winnerEntryId || match.isThirdPlace) continue;

      const aBye = match.slotA.isBye;
      const bBye = match.slotB.isBye;
      const aEntry = match.slotA.entryId;
      const bEntry = match.slotB.entryId;

      let winner: string | null = null;
      if (aBye && bEntry) winner = bEntry;
      else if (bBye && aEntry) winner = aEntry;
      else if (aBye && bBye) {
        // Both bye — should not happen in well-formed brackets; leave unresolved.
        continue;
      }

      if (!winner) continue;

      match.winnerEntryId = winner;
      placeWinnerIntoNext(clone, match, winner);
      changed = true;
    }
  }

  return clone;
}

function placeWinnerIntoNext(
  bracket: Bracket,
  match: BracketMatch,
  winnerEntryId: string,
): void {
  if (!match.nextMatchId || !match.nextMatchSlot) return;

  const next = bracket.matches.find((row) => row.id === match.nextMatchId);
  if (!next) return;

  const slot = match.nextMatchSlot === "A" ? next.slotA : next.slotB;
  // Idempotent: only write if empty or already the same winner.
  if (slot.entryId == null || slot.entryId === winnerEntryId) {
    slot.entryId = winnerEntryId;
    slot.isBye = false;
  }
}

function placeLoserIntoNext(
  bracket: Bracket,
  match: BracketMatch,
  loserEntryId: string,
): void {
  if (!match.loserNextMatchId || !match.loserNextMatchSlot) return;

  const next = bracket.matches.find((row) => row.id === match.loserNextMatchId);
  if (!next) return;

  const slot =
    match.loserNextMatchSlot === "A" ? next.slotA : next.slotB;
  if (slot.entryId == null || slot.entryId === loserEntryId) {
    slot.entryId = loserEntryId;
    slot.isBye = false;
  }
}

export { placeWinnerIntoNext, placeLoserIntoNext };

/**
 * Generates a knockout bracket from qualifiers.
 */
export function generateBracket(
  input: GenerateBracketInput,
): EngineResult<Bracket> {
  const parsed = generateBracketInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(
      BracketErrorCode.INVALID_INPUT,
      `Invalid generateBracket input: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    );
  }

  const {
    qualifiers,
    bracketSize,
    placementRule,
    byeAssignment = "TOP_SEEDS",
    thirdPlaceEnabled = false,
    avoidSameGroupRoundOne = true,
  } = parsed.data as GenerateBracketInput;

  if (!isPowerOfTwo(bracketSize)) {
    throw new DomainError(
      BracketErrorCode.INVALID_SIZE,
      `Bracket size must be a power of 2; got ${bracketSize}.`,
    );
  }

  if (qualifiers.length > bracketSize) {
    throw new DomainError(
      BracketErrorCode.TOO_MANY_QUALIFIERS,
      `Cannot place ${qualifiers.length} qualifiers into bracket of size ${bracketSize}.`,
    );
  }

  const entryIds = new Set<string>();
  for (const qualifier of qualifiers) {
    if (entryIds.has(qualifier.entryId)) {
      throw new DomainError(
        BracketErrorCode.INVALID_INPUT,
        `Duplicate qualifier entry: ${qualifier.entryId}`,
      );
    }
    entryIds.add(qualifier.entryId);
  }

  const matches = buildMatchSkeleton(bracketSize, thirdPlaceEnabled);
  const slots: Array<BracketMatchSlot | null> = Array.from(
    { length: bracketSize },
    () => null,
  );

  const warnings: EngineWarning[] = [];

  if (placementRule === "BY_QUALIFICATION_SEED") {
    placeByQualificationSeed(slots, qualifiers, bracketSize, byeAssignment);
  } else {
    warnings.push(...placeStandardGroupCross(slots, qualifiers, bracketSize));
  }

  slotsToRoundOne(
    matches,
    slots.map((slot) => slot ?? byeSlot()),
  );

  if (avoidSameGroupRoundOne) {
    warnings.push(...resolveSameGroupRematches(matches));
  }

  const roundCount = Math.log2(bracketSize);
  let bracket: Bracket = {
    bracketSize,
    roundCount,
    matches,
    thirdPlaceEnabled,
  };

  bracket = autoAdvanceByes(bracket);

  return { data: bracket, warnings };
}
