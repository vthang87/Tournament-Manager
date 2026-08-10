"use server";

import { StandingsService } from "@/application/services";
import { getDb } from "@/db/client";
import { withActor, type ActionResult } from "@/features/shared/action-utils";
import type { StandingsResult } from "@/application/services/standings-service";

/** On-demand standings for a group (viewers+). */
export async function calculateGroupStandingsAction(
  groupId: string,
): Promise<ActionResult<StandingsResult>> {
  return withActor(async () => {
    return new StandingsService(getDb()).calculateForGroup(groupId);
  });
}
