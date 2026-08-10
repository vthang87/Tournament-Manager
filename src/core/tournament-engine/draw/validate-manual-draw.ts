import { DomainError } from "@/core/tournament-engine/errors";
import { DrawErrorCode } from "./errors";
import { seedRankToGroupIndex } from "./generate-draw";
import { validateManualDrawInputSchema } from "./schemas";
import type {
  DrawEntry,
  DrawGroup,
  DrawValidation,
  DrawValidationIssue,
  ValidateManualDrawInput,
} from "./types";

function parseInput(input: ValidateManualDrawInput): ValidateManualDrawInput {
  const parsed = validateManualDrawInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(
      DrawErrorCode.INVALID_INPUT,
      `Invalid validateManualDraw input: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    );
  }
  return parsed.data as ValidateManualDrawInput;
}

/**
 * Validates a manual draw allocation.
 * Hard violations → valid=false. Soft violations → warnings (still valid).
 */
export function validateManualDraw(
  input: ValidateManualDrawInput,
): DrawValidation {
  const parsed = parseInput(input);
  const { allocation, entries, groups, configuration } = parsed;

  const issues: DrawValidationIssue[] = [];
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const groupById = new Map(groups.map((group) => [group.id, group]));

  const seenEntries = new Set<string>();
  const countsByGroup = new Map<string, string[]>();

  for (const row of allocation) {
    if (!entryById.has(row.entryId)) {
      issues.push({
        code: DrawErrorCode.UNKNOWN_ENTRY,
        message: `Unknown entry: ${row.entryId}`,
        severity: "error",
        entityIds: [row.entryId],
      });
      continue;
    }

    if (!groupById.has(row.groupId)) {
      issues.push({
        code: DrawErrorCode.UNKNOWN_GROUP,
        message: `Unknown group: ${row.groupId}`,
        severity: "error",
        entityIds: [row.groupId],
      });
      continue;
    }

    if (seenEntries.has(row.entryId)) {
      issues.push({
        code: DrawErrorCode.DUPLICATE_ENTRY,
        message: `Entry ${row.entryId} appears more than once.`,
        severity: "error",
        entityIds: [row.entryId],
      });
    }
    seenEntries.add(row.entryId);

    const list = countsByGroup.get(row.groupId) ?? [];
    list.push(row.entryId);
    countsByGroup.set(row.groupId, list);
  }

  for (const entry of entries) {
    if (!seenEntries.has(entry.id)) {
      issues.push({
        code: DrawErrorCode.UNKNOWN_ENTRY,
        message: `Entry ${entry.id} is missing from allocation.`,
        severity: "error",
        entityIds: [entry.id],
      });
    }
  }

  for (const group of groups) {
    const placed = countsByGroup.get(group.id) ?? [];
    if (placed.length > group.capacity) {
      issues.push({
        code: DrawErrorCode.CAPACITY_EXCEEDED,
        message: `Group ${group.id} has ${placed.length} entries but capacity is ${group.capacity}.`,
        severity: "error",
        entityIds: placed,
      });
    }
  }

  // Soft: seed distribution deviations.
  const seeded = entries
    .filter((entry) => entry.seed != null && seenEntries.has(entry.id))
    .sort((a, b) => {
      const seedDiff = (a.seed ?? 0) - (b.seed ?? 0);
      if (seedDiff !== 0) return seedDiff;
      return a.id.localeCompare(b.id);
    });

  const entryGroup = new Map(
    allocation.map((row) => [row.entryId, row.groupId]),
  );

  for (let rank = 0; rank < seeded.length; rank += 1) {
    const entry = seeded[rank]!;
    const expectedIndex = seedRankToGroupIndex(
      rank,
      groups.length,
      configuration.seedDistribution,
    );
    const expectedGroupId = groups[expectedIndex]?.id;
    const actualGroupId = entryGroup.get(entry.id);
    if (
      expectedGroupId &&
      actualGroupId &&
      actualGroupId !== expectedGroupId
    ) {
      issues.push({
        code: "DRAW_SEED_DISTRIBUTION",
        message: `Seed ${entry.seed} (${entry.id}) is in group ${actualGroupId}; expected ${expectedGroupId} under ${configuration.seedDistribution} distribution.`,
        severity: "warning",
        entityIds: [entry.id],
        groupId: actualGroupId,
        attributeId: expectedGroupId,
      });
    }
  }

  // Soft: same-club / team / region within a group.
  for (const group of groups) {
    const placedIds = countsByGroup.get(group.id) ?? [];
    const placedEntries = placedIds
      .map((id) => entryById.get(id))
      .filter((entry): entry is DrawEntry => entry != null);

    if (configuration.avoidSameClub) {
      pushAttributeWarnings(
        issues,
        group,
        placedEntries,
        (entry) => entry.clubId ?? null,
        "DRAW_SAME_CLUB",
        "club",
      );
    }
    if (configuration.avoidSameTeam) {
      pushAttributeWarnings(
        issues,
        group,
        placedEntries,
        (entry) => entry.teamId ?? null,
        "DRAW_SAME_TEAM",
        "team",
      );
    }
    if (configuration.avoidSameRegion) {
      pushAttributeWarnings(
        issues,
        group,
        placedEntries,
        (entry) => entry.regionId ?? null,
        "DRAW_SAME_REGION",
        "region",
      );
    }
  }

  const hasError = issues.some((issue) => issue.severity === "error");
  return { valid: !hasError, issues };
}

function pushAttributeWarnings(
  issues: DrawValidationIssue[],
  group: DrawGroup,
  placedEntries: DrawEntry[],
  getter: (entry: DrawEntry) => string | null,
  code: string,
  label: string,
): void {
  const buckets = new Map<string, string[]>();
  for (const entry of placedEntries) {
    const key = getter(entry);
    if (!key) continue;
    const list = buckets.get(key) ?? [];
    list.push(entry.id);
    buckets.set(key, list);
  }
  for (const [key, entryIds] of buckets) {
    if (entryIds.length > 1) {
      issues.push({
        code,
        message: `Group ${group.id} contains ${entryIds.length} entries from ${label} ${key}.`,
        severity: "warning",
        entityIds: entryIds,
        groupId: group.id,
        attributeId: key,
      });
    }
  }
}
