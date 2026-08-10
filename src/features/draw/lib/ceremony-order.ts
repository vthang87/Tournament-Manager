export type CeremonyPlacement = {
  groupId: string;
  entryId: string;
  position: number;
  displayName: string;
  seed: number | null;
  /** Club short code (mã CLB), e.g. GVS */
  clubCode: string | null;
  /** Full club name */
  clubName: string | null;
};

export { formatClubLabel } from "@/lib/club-label";

/** Sort seeds first (ascending), then by position for a ceremonial order. */
export function orderPlacementsForCeremony(
  placements: CeremonyPlacement[],
): CeremonyPlacement[] {
  return [...placements].sort((a, b) => {
    const aSeed = a.seed ?? 999;
    const bSeed = b.seed ?? 999;
    if (aSeed !== bSeed) return aSeed - bSeed;
    if (a.position !== b.position) return a.position - b.position;
    return a.displayName.localeCompare(b.displayName);
  });
}
