export type DrawAllocationRow = {
  groupId: string;
  entryId: string;
  position: number;
};

export type GroupBuckets = Record<string, string[]>;

/** Build ordered entry id lists per group from flat allocation rows. */
export function bucketsFromResults(
  groupIds: string[],
  results: Array<{ groupId: string; entryId: string; position: number }>,
): GroupBuckets {
  const buckets: GroupBuckets = Object.fromEntries(
    groupIds.map((id) => [id, [] as string[]]),
  );
  const sorted = [...results].sort((a, b) => {
    if (a.groupId !== b.groupId) {
      return a.groupId.localeCompare(b.groupId);
    }
    return a.position - b.position;
  });
  for (const row of sorted) {
    const list = buckets[row.groupId];
    if (list) {
      list.push(row.entryId);
    }
  }
  return buckets;
}

/** Flatten group buckets into allocation payload for the draw service. */
export function allocationFromBuckets(
  buckets: GroupBuckets,
): DrawAllocationRow[] {
  const rows: DrawAllocationRow[] = [];
  for (const [groupId, entryIds] of Object.entries(buckets)) {
    entryIds.forEach((entryId, position) => {
      rows.push({ groupId, entryId, position });
    });
  }
  return rows;
}

/** Move an entry from one group to another (append, or insert at index). */
export function moveEntryBetweenGroups(
  buckets: GroupBuckets,
  entryId: string,
  toGroupId: string,
  toIndex?: number,
): GroupBuckets {
  const next: GroupBuckets = {};
  let found = false;
  for (const [groupId, entryIds] of Object.entries(buckets)) {
    next[groupId] = entryIds.filter((id) => {
      if (id === entryId) {
        found = true;
        return false;
      }
      return true;
    });
  }
  if (!found || !next[toGroupId]) {
    return buckets;
  }
  const dest = [...next[toGroupId]];
  const insertAt =
    toIndex === undefined || toIndex < 0 || toIndex > dest.length
      ? dest.length
      : toIndex;
  dest.splice(insertAt, 0, entryId);
  next[toGroupId] = dest;
  return next;
}

/** Suggest groupCount / capacity for N active entries (prefer 4-per-group). */
export function suggestDrawCapacity(entryCount: number): {
  groupCount: number;
  capacityPerGroup: number;
} {
  if (entryCount <= 0) {
    return { groupCount: 1, capacityPerGroup: 4 };
  }
  const capacityPerGroup = 4;
  const groupCount = Math.max(1, Math.ceil(entryCount / capacityPerGroup));
  return { groupCount, capacityPerGroup };
}
