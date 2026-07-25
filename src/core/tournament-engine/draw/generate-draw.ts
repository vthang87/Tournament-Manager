import { DomainError } from "@/core/tournament-engine/errors";
import type { EngineResult, EngineWarning } from "@/core/tournament-engine/types";
import { DrawErrorCode } from "./errors";
import { createSeededRandom, seededShuffle } from "./prng";
import { generateDrawInputSchema } from "./schemas";
import type {
  DrawAllocation,
  DrawEntry,
  DrawGroup,
  DrawResultData,
  GenerateDrawInput,
  SeedDistribution,
} from "./types";

type MutableGroup = {
  group: DrawGroup;
  entries: DrawEntry[];
};

function parseInput(input: GenerateDrawInput): GenerateDrawInput {
  const parsed = generateDrawInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(
      DrawErrorCode.INVALID_INPUT,
      `Invalid generateDraw input: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    );
  }
  return parsed.data as GenerateDrawInput;
}

function assertUniqueEntryIds(entries: DrawEntry[]): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      throw new DomainError(
        DrawErrorCode.DUPLICATE_ENTRY,
        `Duplicate entry id: ${entry.id}`,
      );
    }
    seen.add(entry.id);
  }
}

function assertUniqueGroupIds(groups: DrawGroup[]): void {
  const seen = new Set<string>();
  for (const group of groups) {
    if (seen.has(group.id)) {
      throw new DomainError(
        DrawErrorCode.INVALID_INPUT,
        `Duplicate group id: ${group.id}`,
      );
    }
    seen.add(group.id);
  }
}

function assertCapacity(entries: DrawEntry[], groups: DrawGroup[]): void {
  const totalCapacity = groups.reduce((sum, group) => sum + group.capacity, 0);
  if (entries.length > totalCapacity) {
    throw new DomainError(
      DrawErrorCode.INSUFFICIENT_CAPACITY,
      `Need capacity for ${entries.length} entries but groups only hold ${totalCapacity}.`,
    );
  }
}

function assertSeedsValid(entries: DrawEntry[]): void {
  const seeds = new Map<number, string>();
  for (const entry of entries) {
    if (entry.seed == null) continue;
    if (!(Number.isInteger(entry.seed) && entry.seed > 0)) {
      throw new DomainError(
        DrawErrorCode.INVALID_SEED,
        `Invalid seed value for entry ${entry.id}`,
      );
    }
    const existing = seeds.get(entry.seed);
    if (existing) {
      throw new DomainError(
        DrawErrorCode.INVALID_SEED,
        `Duplicate seed ${entry.seed} on entries ${existing} and ${entry.id}`,
      );
    }
    seeds.set(entry.seed, entry.id);
  }
}

/**
 * Maps 0-based seed rank (among sorted seeds) to a group index.
 * NORMAL: 0,1,2,...,0,1,2,...
 * SERPENTINE: 0,1,2,...,n-1 then n-1,...,1,0 then repeat.
 */
export function seedRankToGroupIndex(
  seedRank: number,
  groupCount: number,
  distribution: SeedDistribution,
): number {
  if (groupCount <= 0) {
    throw new DomainError(DrawErrorCode.EMPTY_GROUPS, "No groups provided.");
  }

  const round = Math.floor(seedRank / groupCount);
  const offset = seedRank % groupCount;

  if (distribution === "NORMAL") {
    return offset;
  }

  return round % 2 === 0 ? offset : groupCount - 1 - offset;
}

function remainingCapacity(bucket: MutableGroup): number {
  return bucket.group.capacity - bucket.entries.length;
}

function clubKey(entry: DrawEntry): string | null {
  return entry.clubId ?? null;
}

function teamKey(entry: DrawEntry): string | null {
  return entry.teamId ?? null;
}

function regionKey(entry: DrawEntry): string | null {
  return entry.regionId ?? null;
}

function countAttribute(
  bucket: MutableGroup,
  key: string | null,
  getter: (entry: DrawEntry) => string | null,
): number {
  if (key == null) return 0;
  return bucket.entries.filter((entry) => getter(entry) === key).length;
}

function softConflictScore(
  bucket: MutableGroup,
  entry: DrawEntry,
  configuration: GenerateDrawInput["configuration"],
): number {
  let score = 0;
  if (configuration.avoidSameClub && clubKey(entry) != null) {
    score += countAttribute(bucket, clubKey(entry), clubKey);
  }
  if (configuration.avoidSameTeam && teamKey(entry) != null) {
    score += countAttribute(bucket, teamKey(entry), teamKey);
  }
  if (configuration.avoidSameRegion && regionKey(entry) != null) {
    score += countAttribute(bucket, regionKey(entry), regionKey);
  }
  return score;
}

/**
 * Chooses the best eligible group for an unseeded entry.
 * Priority: capacity → minimize soft conflicts → fewest members (balance) →
 * earliest group index (deterministic).
 */
function chooseGroupForEntry(
  buckets: MutableGroup[],
  entry: DrawEntry,
  configuration: GenerateDrawInput["configuration"],
): MutableGroup {
  const eligible = buckets.filter((bucket) => remainingCapacity(bucket) > 0);
  if (eligible.length === 0) {
    throw new DomainError(
      DrawErrorCode.INSUFFICIENT_CAPACITY,
      `No remaining capacity for entry ${entry.id}`,
    );
  }

  eligible.sort((a, b) => {
    const conflictA = softConflictScore(a, entry, configuration);
    const conflictB = softConflictScore(b, entry, configuration);
    if (conflictA !== conflictB) return conflictA - conflictB;

    const sizeA = a.entries.length;
    const sizeB = b.entries.length;
    if (sizeA !== sizeB) return sizeA - sizeB;

    const indexA = buckets.indexOf(a);
    const indexB = buckets.indexOf(b);
    return indexA - indexB;
  });

  return eligible[0]!;
}

function buildAllocations(buckets: MutableGroup[]): DrawAllocation[] {
  const allocations: DrawAllocation[] = [];

  for (const bucket of buckets) {
    const ordered = [...bucket.entries].sort((a, b) => {
      const seedA = a.seed ?? Number.POSITIVE_INFINITY;
      const seedB = b.seed ?? Number.POSITIVE_INFINITY;
      if (seedA !== seedB) return seedA - seedB;
      return a.id.localeCompare(b.id);
    });

    ordered.forEach((entry, position) => {
      allocations.push({
        groupId: bucket.group.id,
        entryId: entry.id,
        position,
      });
    });
  }

  return allocations;
}

function collectSoftWarnings(
  buckets: MutableGroup[],
  configuration: GenerateDrawInput["configuration"],
): EngineWarning[] {
  const warnings: EngineWarning[] = [];

  for (const bucket of buckets) {
    if (configuration.avoidSameClub) {
      const clubs = new Map<string, string[]>();
      for (const entry of bucket.entries) {
        const club = clubKey(entry);
        if (!club) continue;
        const list = clubs.get(club) ?? [];
        list.push(entry.id);
        clubs.set(club, list);
      }
      for (const [club, entryIds] of clubs) {
        if (entryIds.length > 1) {
          warnings.push({
            code: "DRAW_SAME_CLUB",
            message: `Group ${bucket.group.id} contains ${entryIds.length} entries from club ${club} because no valid alternative allocation exists.`,
            entityIds: entryIds,
            groupId: bucket.group.id,
            attributeId: club,
          });
        }
      }
    }

    if (configuration.avoidSameTeam) {
      const teams = new Map<string, string[]>();
      for (const entry of bucket.entries) {
        const team = teamKey(entry);
        if (!team) continue;
        const list = teams.get(team) ?? [];
        list.push(entry.id);
        teams.set(team, list);
      }
      for (const [team, entryIds] of teams) {
        if (entryIds.length > 1) {
          warnings.push({
            code: "DRAW_SAME_TEAM",
            message: `Group ${bucket.group.id} contains ${entryIds.length} entries from team ${team}.`,
            entityIds: entryIds,
            groupId: bucket.group.id,
            attributeId: team,
          });
        }
      }
    }

    if (configuration.avoidSameRegion) {
      const regions = new Map<string, string[]>();
      for (const entry of bucket.entries) {
        const region = regionKey(entry);
        if (!region) continue;
        const list = regions.get(region) ?? [];
        list.push(entry.id);
        regions.set(region, list);
      }
      for (const [region, entryIds] of regions) {
        if (entryIds.length > 1) {
          warnings.push({
            code: "DRAW_SAME_REGION",
            message: `Group ${bucket.group.id} contains ${entryIds.length} entries from region ${region}.`,
            entityIds: entryIds,
            groupId: bucket.group.id,
            attributeId: region,
          });
        }
      }
    }
  }

  warnings.sort((a, b) => a.code.localeCompare(b.code) || (a.message > b.message ? 1 : -1));
  return warnings;
}

/**
 * Generates a deterministic group draw.
 * Hard constraints (unique placement, capacity, seed slots) are never violated.
 * Soft constraints emit warnings when unavoidable.
 */
export function generateDraw(
  input: GenerateDrawInput,
): EngineResult<DrawResultData> {
  const parsed = parseInput(input);
  const { entries, groups, configuration, randomSeed } = parsed;

  assertUniqueEntryIds(entries);
  assertUniqueGroupIds(groups);
  assertCapacity(entries, groups);
  assertSeedsValid(entries);

  const buckets: MutableGroup[] = groups.map((group) => ({
    group,
    entries: [],
  }));

  const seeded = entries
    .filter((entry) => entry.seed != null)
    .sort((a, b) => {
      const seedDiff = (a.seed ?? 0) - (b.seed ?? 0);
      if (seedDiff !== 0) return seedDiff;
      return a.id.localeCompare(b.id);
    });

  const unseeded = entries.filter((entry) => entry.seed == null);

  // Place seeds according to configured distribution (hard constraint).
  for (let rank = 0; rank < seeded.length; rank += 1) {
    const entry = seeded[rank]!;
    const groupIndex = seedRankToGroupIndex(
      rank,
      buckets.length,
      configuration.seedDistribution,
    );
    const bucket = buckets[groupIndex]!;
    if (remainingCapacity(bucket) <= 0) {
      throw new DomainError(
        DrawErrorCode.SEED_SLOT_CONFLICT,
        `Cannot place seed ${entry.seed} into group ${bucket.group.id}: capacity exceeded.`,
      );
    }
    bucket.entries.push(entry);
  }

  const random = createSeededRandom(randomSeed);
  const shuffledUnseeded = seededShuffle(unseeded, random);

  for (const entry of shuffledUnseeded) {
    const bucket = chooseGroupForEntry(buckets, entry, configuration);
    bucket.entries.push(entry);
  }

  const allocations = buildAllocations(buckets);
  const byGroup = buckets.map((bucket) => ({
    groupId: bucket.group.id,
    entryIds: allocations
      .filter((row) => row.groupId === bucket.group.id)
      .sort((a, b) => a.position - b.position)
      .map((row) => row.entryId),
  }));

  return {
    data: { allocations, byGroup },
    warnings: collectSoftWarnings(buckets, configuration),
  };
}
