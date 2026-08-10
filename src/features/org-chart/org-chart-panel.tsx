"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { MatchBracketOrgChart } from "./match-bracket-org-chart";
import { OrgChartTree } from "./org-chart-tree";
import type { MatchOrgChartEvent, OrgChartNode } from "./types";

export function OrgChartPanel({
  tournamentId,
  structureTree,
  matchEvents,
}: {
  tournamentId: string;
  structureTree: OrgChartNode;
  matchEvents: MatchOrgChartEvent[];
}) {
  const t = useTranslations("orgChart");
  const [tab, setTab] = useState<"structure" | "matches">("structure");
  const [eventId, setEventId] = useState(matchEvents[0]?.eventId ?? "");

  const active =
    matchEvents.find((e) => e.eventId === eventId) ?? matchEvents[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={tab === "structure" ? "default" : "outline"}
          onClick={() => setTab("structure")}
        >
          {t("tabStructure")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tab === "matches" ? "default" : "outline"}
          onClick={() => setTab("matches")}
        >
          {t("tabMatches")}
        </Button>
      </div>

      {tab === "structure" ? (
        <div className="rounded-lg border border-slate-200 bg-white py-6">
          <p className="mb-4 px-4 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
            {t("structureHint")}
          </p>
          <OrgChartTree root={structureTree} />
        </div>
      ) : (
        <div className="space-y-4">
          {matchEvents.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {matchEvents.map((e) => (
                <Button
                  key={e.eventId}
                  type="button"
                  size="sm"
                  variant={
                    active?.eventId === e.eventId ? "secondary" : "outline"
                  }
                  onClick={() => setEventId(e.eventId)}
                >
                  {e.eventName}
                </Button>
              ))}
            </div>
          ) : null}

          {!active ? (
            <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              {t("noMatchTree")}
            </p>
          ) : (
            <>
              {active.groupSummary ? (
                <div className="rounded-lg border border-slate-200 bg-white py-6">
                  <p className="mb-4 px-4 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
                    {t("groupSummaryHint")}
                  </p>
                  <OrgChartTree root={active.groupSummary} />
                </div>
              ) : null}

              {active.board ? (
                <div className="space-y-3">
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
                    {t("knockoutModelHint")}
                  </p>
                  <MatchBracketOrgChart
                    board={active.board}
                    tournamentId={tournamentId}
                    eventId={active.eventId}
                    dropFromMatchIds={active.dropFromMatchIds}
                  />
                </div>
              ) : (
                <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                  {t("noKnockoutYet")}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
