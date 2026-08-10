/**
 * Derive round labels from bracket structure (round index + remaining size),
 * not from stage type/name strings.
 */
export function roundLabelFromStructure(
  roundIndex: number,
  roundCount: number,
  options?: { isThirdPlace?: boolean },
): string {
  if (options?.isThirdPlace) {
    return "3rd Place";
  }
  const remaining = 2 ** (roundCount - roundIndex);
  if (remaining === 2) return "Final";
  if (remaining === 4) return "Semifinals";
  if (remaining === 8) return "Quarterfinals";
  return `Round of ${remaining}`;
}

/** Smallest power of two ≥ value (min 2). */
export function nextPowerOfTwo(value: number): number {
  if (value <= 2) return 2;
  let n = 1;
  while (n < value) n *= 2;
  return n;
}

export function formatSetScore(
  sets: Array<{ scoreA: number; scoreB: number; winnerEntryId: string | null }>,
): string | null {
  if (sets.length === 0) return null;
  return sets
    .map((s) => `${s.scoreA}–${s.scoreB}`)
    .join(", ");
}
