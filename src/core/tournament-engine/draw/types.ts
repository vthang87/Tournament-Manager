/** Draw engine domain types (plain objects; no DB/ORM types). */

export type SeedDistribution = "NORMAL" | "SERPENTINE";

export type DrawEntry = {
  id: string;
  /** Lower number = stronger seed. Null/undefined = unseeded. */
  seed?: number | null;
  clubId?: string | null;
  teamId?: string | null;
  regionId?: string | null;
};

export type DrawGroup = {
  id: string;
  name?: string;
  capacity: number;
};

export type DrawConfiguration = {
  seedDistribution: SeedDistribution;
  avoidSameClub: boolean;
  avoidSameTeam?: boolean;
  avoidSameRegion?: boolean;
};

export type DrawAllocation = {
  groupId: string;
  entryId: string;
  /** 0-based position within the group. */
  position: number;
};

export type DrawResultData = {
  allocations: DrawAllocation[];
  /** Allocations grouped for convenience; order matches input groups. */
  byGroup: Array<{
    groupId: string;
    entryIds: string[];
  }>;
};

export type GenerateDrawInput = {
  entries: DrawEntry[];
  groups: DrawGroup[];
  configuration: DrawConfiguration;
  /** Deterministic seed; same inputs + seed → same allocation. */
  randomSeed: number | string;
};

export type ManualDrawAllocation = {
  groupId: string;
  entryId: string;
  position?: number;
};

export type ValidateManualDrawInput = {
  allocation: ManualDrawAllocation[];
  entries: DrawEntry[];
  groups: DrawGroup[];
  configuration: DrawConfiguration;
};

export type DrawValidationIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
  entityIds?: string[];
  groupId?: string;
  attributeId?: string;
};

export type DrawValidation = {
  valid: boolean;
  issues: DrawValidationIssue[];
};
