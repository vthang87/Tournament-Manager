import { formatClubLabel } from "@/lib/club-label";
import type { DrawEntryView, DrawGroupView } from "../components/draw-board";

export type DrawIssueView = {
  code: string;
  message: string;
  severity: "error" | "warning";
  entityIds?: string[];
  groupId?: string;
  attributeId?: string;
};

type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

function formatGroupLabel(
  group: DrawGroupView | undefined,
  t: Translate,
): string {
  if (!group) return t("unknownGroup");
  const name = group.name?.trim();
  if (name) return name;
  return `${t("group")} ${group.code}`;
}

function formatEntryList(
  entityIds: string[] | undefined,
  entriesById: Map<string, DrawEntryView>,
): string {
  if (!entityIds?.length) return "";
  return entityIds
    .map((id) => entriesById.get(id)?.displayName ?? id)
    .join(", ");
}

function formatClubFromIssue(
  issue: DrawIssueView,
  entriesById: Map<string, DrawEntryView>,
  t: Translate,
): string {
  const entryId = issue.entityIds?.[0];
  const entry = entryId ? entriesById.get(entryId) : undefined;
  const label = formatClubLabel(entry?.clubCode, entry?.clubName);
  if (label) return label;
  return issue.attributeId ?? t("unknownClub");
}

export function localizeDrawIssue(
  issue: DrawIssueView,
  context: {
    groupsById: Map<string, DrawGroupView>;
    entriesById: Map<string, DrawEntryView>;
    t: Translate;
  },
): string {
  const { groupsById, entriesById, t } = context;
  const group = issue.groupId ? groupsById.get(issue.groupId) : undefined;
  const groupLabel = formatGroupLabel(group, t);
  const entries = formatEntryList(issue.entityIds, entriesById);
  const count = issue.entityIds?.length ?? 0;

  switch (issue.code) {
    case "DRAW_SAME_CLUB":
      return t("issueSameClub", {
        group: groupLabel,
        club: formatClubFromIssue(issue, entriesById, t),
        count,
        entries,
      });
    case "DRAW_SAME_TEAM":
      return t("issueSameTeam", {
        group: groupLabel,
        team: issue.attributeId ?? t("unknownTeam"),
        count,
        entries,
      });
    case "DRAW_SAME_REGION":
      return t("issueSameRegion", {
        group: groupLabel,
        region: issue.attributeId ?? t("unknownRegion"),
        count,
        entries,
      });
    case "DRAW_SEED_DISTRIBUTION": {
      const entryId = issue.entityIds?.[0];
      const entry = entryId ? entriesById.get(entryId) : undefined;
      const actualGroup = formatGroupLabel(group, t);
      const expectedGroup = formatGroupLabel(
        issue.attributeId ? groupsById.get(issue.attributeId) : undefined,
        t,
      );
      return t("issueSeedDistribution", {
        seed: entry?.seed ?? "?",
        entry: entry?.displayName ?? entryId ?? "?",
        actualGroup,
        expectedGroup,
      });
    }
    default:
      return issue.message;
  }
}
