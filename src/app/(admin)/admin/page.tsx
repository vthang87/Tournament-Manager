import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardService } from "@/application/services";
import { getDb } from "@/db/client";
import {
  eventStatusKey,
  matchStatusKey,
  stageStatusKey,
  tournamentStatusKey,
} from "@/i18n/status-labels";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const t = await getTranslations("dashboard");
  const tt = await getTranslations("tournaments");
  const tc = await getTranslations("common");
  const tStatus = await getTranslations("status");
  const summaries = await new DashboardService(getDb()).summarizeAll();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("subtitle")}</p>
      </div>

      {summaries.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("noTournamentsYet")}</CardTitle>
            <CardDescription>
              Run <code className="rounded bg-slate-100 px-1">pnpm db:seed</code>{" "}
              {t("runSeedHint")}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-6">
          {summaries.map((s) => (
            <Card key={s.tournamentId}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{s.name}</CardTitle>
                  <CardDescription>
                    {tStatus(tournamentStatusKey(s.status))} · /{s.slug}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <Link
                    href={`/admin/tournaments/${s.tournamentId}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {tc("admin")}
                  </Link>
                  <Link
                    href={`/admin/tournaments/${s.tournamentId}/live`}
                    className="underline-offset-4 hover:underline"
                  >
                    {tt("liveBoard")}
                  </Link>
                  <Link
                    href={`/admin/tournaments/${s.tournamentId}/courts/live`}
                    className="underline-offset-4 hover:underline"
                  >
                    {t("courts")}
                  </Link>
                  <Link
                    href={`/t/${s.slug}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {t("public")}
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      {t("entries")}
                    </dt>
                    <dd className="text-2xl font-semibold tabular-nums">
                      {s.entryCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      {t("completed")}
                    </dt>
                    <dd className="text-2xl font-semibold tabular-nums text-emerald-800">
                      {s.matchesCompleted}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      {t("pending")}
                    </dt>
                    <dd className="text-2xl font-semibold tabular-nums">
                      {s.matchesPending}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      {t("inProgress")}
                    </dt>
                    <dd className="text-2xl font-semibold tabular-nums text-amber-800">
                      {s.matchesInProgress}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      {t("courts")}
                    </dt>
                    <dd className="text-2xl font-semibold tabular-nums">
                      {s.courtCount}
                    </dd>
                  </div>
                </dl>

                <div>
                  <h2 className="text-sm font-medium text-slate-800">
                    {t("currentStage")}
                  </h2>
                  {s.currentStages.length === 0 ? (
                    <p className="mt-1 text-sm text-slate-600">{t("noStagesYet")}</p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-sm text-slate-700">
                      {s.currentStages.map((stage) => (
                        <li key={stage.stageId}>
                          {stage.eventName}: {stage.stageName} (
                          {tStatus(stageStatusKey(stage.stageStatus))})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h2 className="text-sm font-medium text-slate-800">
                    {t("upcomingMatches")}
                  </h2>
                  {s.upcoming.length === 0 ? (
                    <p className="mt-1 text-sm text-slate-600">{t("noneScheduled")}</p>
                  ) : (
                    <div className="mt-2 overflow-x-auto rounded-md border border-slate-200">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead scope="col">{tc("when")}</TableHead>
                            <TableHead scope="col">{tc("event")}</TableHead>
                            <TableHead scope="col">{tc("match")}</TableHead>
                            <TableHead scope="col">{tc("court")}</TableHead>
                            <TableHead scope="col">{tc("status")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {s.upcoming.map((m) => (
                            <TableRow key={m.matchId}>
                              <TableCell className="whitespace-nowrap text-sm">
                                {m.scheduledAt
                                  ? new Date(m.scheduledAt).toLocaleString()
                                  : tc("dash")}
                              </TableCell>
                              <TableCell>{m.eventName}</TableCell>
                              <TableCell>
                                {m.entryAName ?? tc("tbd")} {tc("vs")}{" "}
                                {m.entryBName ?? tc("tbd")}
                              </TableCell>
                              <TableCell>{m.courtCode ?? tc("dash")}</TableCell>
                              <TableCell>
                                {tStatus(matchStatusKey(m.status))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
