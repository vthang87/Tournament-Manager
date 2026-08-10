import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
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
  matchStatusKey,
  stageStatusKey,
  tournamentStatusKey,
} from "@/i18n/status-labels";
import { requireAuthOrRedirect } from "@/lib/auth/require-auth";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata() {
  const t = await getTranslations("dashboard");
  return pageTitle(t("title"));
}

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const t = await getTranslations("dashboard");
  const tt = await getTranslations("tournaments");
  const tc = await getTranslations("common");
  const tStatus = await getTranslations("status");
  const locale = await getLocale();
  const user = await requireAuthOrRedirect();
  const summaries = await new DashboardService(getDb()).summarizeAll({
    userId: user.id,
    role: user.role,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("subtitle")}</p>
      </div>

      {summaries.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("noAccessibleTournaments")}</CardTitle>
            <CardDescription>{t("requestAccessHint")}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-6">
          {summaries.map((s) => (
            <Card key={s.tournamentId}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 p-4 sm:p-6">
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
                    href={`/t/${s.slug}/live`}
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
              <CardContent className="space-y-4 px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
                <dl className="grid grid-cols-3 gap-x-2 gap-y-3 lg:grid-cols-5">
                  <div>
                    <dt className="text-[11px] uppercase leading-tight tracking-wide text-slate-500 sm:text-xs">
                      {t("entries")}
                    </dt>
                    <dd className="text-xl font-semibold tabular-nums sm:text-2xl">
                      {s.entryCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase leading-tight tracking-wide text-slate-500 sm:text-xs">
                      {t("completed")}
                    </dt>
                    <dd className="text-xl font-semibold tabular-nums text-emerald-800 sm:text-2xl">
                      {s.matchesCompleted}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase leading-tight tracking-wide text-slate-500 sm:text-xs">
                      {t("pending")}
                    </dt>
                    <dd className="text-xl font-semibold tabular-nums sm:text-2xl">
                      {s.matchesPending}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase leading-tight tracking-wide text-slate-500 sm:text-xs">
                      {t("inProgress")}
                    </dt>
                    <dd className="text-xl font-semibold tabular-nums text-amber-800 sm:text-2xl">
                      {s.matchesInProgress}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase leading-tight tracking-wide text-slate-500 sm:text-xs">
                      {t("courts")}
                    </dt>
                    <dd className="text-xl font-semibold tabular-nums sm:text-2xl">
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
                    <>
                      <div className="mt-2 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 sm:hidden">
                        {s.upcoming.map((m) => (
                          <article key={m.matchId} className="space-y-2 p-3">
                            <p className="text-xs font-medium text-slate-500">
                              {m.eventName}
                            </p>
                            <p className="text-sm font-semibold leading-snug text-slate-900">
                              {m.entryAName ?? tc("tbd")} {tc("vs")}{" "}
                              {m.entryBName ?? tc("tbd")}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                              <time
                                dateTime={m.scheduledAt ?? undefined}
                                className="tabular-nums"
                              >
                                {m.scheduledAt
                                  ? new Date(m.scheduledAt).toLocaleString(
                                      locale,
                                      {
                                        dateStyle: "short",
                                        timeStyle: "short",
                                      },
                                    )
                                  : tc("dash")}
                              </time>
                              <span>
                                {tc("court")}: {m.courtCode ?? tc("dash")}
                              </span>
                              <span className="font-medium text-slate-800">
                                {tStatus(matchStatusKey(m.status))}
                              </span>
                            </div>
                          </article>
                        ))}
                      </div>

                      <div className="mt-2 hidden overflow-x-auto rounded-md border border-slate-200 sm:block">
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
                                    ? new Date(m.scheduledAt).toLocaleString(
                                        locale,
                                      )
                                    : tc("dash")}
                                </TableCell>
                                <TableCell>{m.eventName}</TableCell>
                                <TableCell>
                                  {m.entryAName ?? tc("tbd")} {tc("vs")}{" "}
                                  {m.entryBName ?? tc("tbd")}
                                </TableCell>
                                <TableCell>
                                  {m.courtCode ?? tc("dash")}
                                </TableCell>
                                <TableCell>
                                  {tStatus(matchStatusKey(m.status))}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
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
