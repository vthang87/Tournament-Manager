import type { BracketBoardView } from "@/features/bracket/lib/build-bracket-view";

export type OrgChartNode = {
  id: string;
  label: string;
  sublabel?: string;
  /** Optional third line (e.g. score). */
  meta?: string;
  href?: string;
  /** Visual tone for the node card. */
  tone?: "root" | "event" | "stage" | "group" | "match" | "court" | "muted";
  status?: string;
  children?: OrgChartNode[];
};

export type TournamentOrgChartData = {
  tournamentId: string;
  tournamentName: string;
  tree: OrgChartNode;
};

export type MatchOrgChartEvent = {
  eventId: string;
  eventName: string;
  /** Column bracket for knockout (dark org-chart UI). */
  board: BracketBoardView | null;
  /** Main-bracket match ids whose losers feed the consolation / 3rd-place match. */
  dropFromMatchIds: string[];
  /** Group-stage summary nodes (not every RR match). */
  groupSummary: OrgChartNode | null;
};
