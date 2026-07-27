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
import { localizeStandingCriterion } from "@/features/standings/criterion-labels";
import { cn } from "@/lib/utils";

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

  const criterionLabel = (criterion: string) =>
    localizeStandingCriterion(criterion, t);

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
        {t("noStandingsYet")}
      </p>
    );
  }

  return (
    <>
      <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white sm:hidden">
        {rows.map((row) => {
          const open = expanded === row.entryId;
          return (
            <article
              key={row.entryId}
              className={cn(
                "p-3",
                row.rank === 1
                  ? "bg-amber-50/80"
                  : row.rank === 2
                    ? "bg-sky-50/80"
                    : row.drawRequired && "bg-amber-50/60",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white font-semibold tabular-nums text-slate-900 shadow-sm">
                  {row.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug text-slate-900">
                    {labelOf(row.entryId)}
                  </p>
                  {row.drawRequired ? (
                    <p className="mt-0.5 text-xs text-amber-800">
                      {t("drawRequiredBadge")}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="shrink-0 text-xs font-medium text-slate-600 underline"
                  onClick={() => setExpanded(open ? null : row.entryId)}
                >
                  {open ? tCommon("hide") : tCommon("tieBreak")}
                </button>
              </div>

              <dl className="mt-3 grid grid-cols-5 gap-1 border-t border-slate-200/70 pt-2 text-center">
                {[
                  [tCommon("played"), row.played],
                  [tCommon("wins"), row.wins],
                  [tCommon("losses"), row.losses],
                  [
                    tCommon("setDiff"),
                    `${row.setDifference > 0 ? "+" : ""}${row.setDifference}`,
                  ],
                  [
                    tCommon("pointDiff"),
                    `${row.pointDifference > 0 ? "+" : ""}${row.pointDifference}`,
                  ],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt className="truncate text-[10px] uppercase tracking-wide text-slate-500">
                      {label}
                    </dt>
                    <dd className="mt-0.5 font-medium tabular-nums text-slate-900">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              {open ? (
                <div className="mt-3 border-t border-slate-200/70 pt-3">
                  <TieBreakTrace
                    row={row}
                    labelOf={labelOf}
                    criterionLabel={criterionLabel}
                    t={t}
                    tCommon={tCommon}
                  />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto sm:block">
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
                className={cn(
                  row.rank === 1
                    ? "bg-amber-50/80 hover:bg-amber-100/70"
                    : row.rank === 2
                      ? "bg-sky-50/80 hover:bg-sky-100/70"
                      : row.drawRequired && "bg-amber-50/60",
                )}
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
      </div>
    </>
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
