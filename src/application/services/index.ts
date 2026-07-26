export { TournamentService } from "./tournament-service";
export { TournamentAccessService } from "./tournament-access-service";
export { TournamentMemberService } from "./tournament-member-service";
export { SportService } from "./sport-service";
export { ProfileService } from "./profile-service";
export { UserManagementService } from "./user-management-service";
export { EventService } from "./event-service";
export { CourtService } from "./court-service";
export { StageService } from "./stage-service";
export { MatchRuleService } from "./match-rule-service";
export { EventSetupService } from "./event-setup-service";
export { ClubService } from "./club-service";
export { PlayerService } from "./player-service";
export { EntryService } from "./entry-service";
export { DrawService } from "./draw-service";
export { MatchGenerationService } from "./match-generation-service";
export { MatchOpsService } from "./match-ops-service";
export { StandingsService } from "./standings-service";
export { BracketService } from "./bracket-service";
export { ScheduleService } from "./schedule-service";
export { DashboardService } from "./dashboard-service";
export { PublicViewService } from "./public-view-service";
export { ExcelImportService } from "./excel-import-service";
export { ExcelExportService } from "./excel-export-service";

import type { AppDatabase } from "@/db/client";
import { BracketService } from "./bracket-service";
import { MatchOpsService } from "./match-ops-service";

/** Convenience factory: MatchOps with knockout advance wired. */
export function createMatchOpsService(db: AppDatabase): MatchOpsService {
  const matchOps = new MatchOpsService(db);
  matchOps.setBracketService(new BracketService(db));
  return matchOps;
}
