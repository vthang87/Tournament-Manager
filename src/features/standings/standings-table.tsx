"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import type { StandingRow } from "@/core/tournament-engine/standings";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const CRITERION_KEYS: Record<
  string,
  | "matchWins"
  | "headToHead"
  | "setDifference"
  | "pointDifference"
  | "pointsWon"
  | "setsWon"
  | "matchesPlayed"
  | "entryIdFallback"
  | "drawRequired"
> = {
  MATCH_WINS: "matchWins",
  HEAD_TO_HEAD: "headToHead",
  SET_DIFFERENCE: "setDifference",
  POINT_DIFFERENCE: "pointDifference",
  POINTS_WON: "pointsWon",
  SETS_WON: "setsWon",
  MATCHES_PLAYED: "matchesPlayed",
  ENTRY_ID: "entryIdFallback",
  DRAW_REQUIRED: "drawRequired",
};

export function StandingsTable({
  rows,
  labels,
}: {
  rows: StandingRow[];
  labels: Map<string, string> | Record<string, string>;
}) {
  const t = useTranslations("standings");
  const tCommon = useTranslations("common");
  const labelOf = (id: string) =>
    labels instanceof Map ? (labels.get(id) ?? id) : (labels[id] ?? id);

  const [expanded, setExpanded] = useState<string | null>(null);

  const criterionLabel = (criterion: string) => {
    const key = CRITERION_KEYS[criterion];
    return key ? t(key) : criterion;
  };

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
        {t("noStandingsYet")}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">{tCommon("rank")}</TableHead>
          <TableHead>{tCommon("entry")}</TableHead>
          <TableHead className="text-right">{tCommon("played")}</TableHead>
          <TableHead className="text-right">{tCommon("wins")}</TableHead>
          <TableHead className="text-right">{tCommon("losses")}</TableHead>
          <TableHead className="text-right">{tCommon("setDiff")}</TableHead>
          <TableHead className="text-right">{tCommon("pointDiff")}</TableHead>
          <TableHead className="w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const open = expanded === row.entryId;
          return (
            <Fragment key={row.entryId}>
              <TableRow
                className={cn(row.drawRequired && "bg-amber-50/60")}
              >
                <TableCell className="font-medium tabular-nums">
                  {row.rank}
                </TableCell>
                <TableCell>
                  <span className="font-medium">{labelOf(row.entryId)}</span>
                  {row.drawRequired ? (
                    <span className="ml-2 text-xs text-amber-800">
                      {t("drawRequiredBadge")}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.played}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.wins}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.losses}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.setDifference > 0 ? "+" : ""}
                  {row.setDifference}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.pointDifference > 0 ? "+" : ""}
                  {row.pointDifference}
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="text-xs font-medium text-slate-600 underline"
                    onClick={() =>
                      setExpanded(open ? null : row.entryId)
                    }
                  >
                    {open ? tCommon("hide") : tCommon("tieBreak")}
                  </button>
                </TableCell>
              </TableRow>
              {open ? (
                <TableRow>
                  <TableCell colSpan={8} className="bg-slate-50">
                    <TieBreakTrace
                      row={row}
                      labelOf={labelOf}
                      criterionLabel={criterionLabel}
                      t={t}
                      tCommon={tCommon}
                    />
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

function TieBreakTrace({
  row,
  labelOf,
  criterionLabel,
  t,
  tCommon,
}: {
  row: StandingRow;
  labelOf: (id: string) => string;
  criterionLabel: (criterion: string) => string;
  t: ReturnType<typeof useTranslations<"standings">>;
  tCommon: ReturnType<typeof useTranslations<"common">>;
}) {
  if (row.tieBreakTrace.length === 0) {
    return (
      <p className="text-sm text-slate-500">{t("noTieBreak")}</p>
    );
  }

  return (
    <ol className="space-y-2 text-sm text-slate-700">
      {row.tieBreakTrace.map((step, i) => (
        <li key={`${step.criterion}-${i}`} className="leading-snug">
          <span className="font-medium">
            {criterionLabel(step.criterion)}
          </span>
          {": "}
          <span className="tabular-nums">{step.value}</span>
          {step.groupEntryIds.length > 1 ? (
            <span className="mt-0.5 block text-xs text-slate-500">
              {tCommon("tiedWith")}{" "}
              {step.groupEntryIds
                .filter((id) => id !== row.entryId)
                .map(labelOf)
                .join(", ") || t("tiedGroupFallback")}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
