import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PublicViewService } from "@/application/services";
import { getDb } from "@/db/client";
import { LocaleSwitcher } from "@/features/i18n/locale-switcher";
import { LiveRefresh } from "@/features/live-board/live-refresh";
import {
  matchStatusRowClass,
  matchStatusTextClass,
} from "@/features/matches/match-status-styles";
import { PublicSectionNav } from "@/features/public-board/public-section-nav";
import { localizeStageName } from "@/features/stages/localize-stage-name";
import { matchStatusKey } from "@/i18n/status-labels";
import { cn } from "@/lib/utils";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations("public");
  try {
    const view = await new PublicViewService(getDb()).getBySlug(slug);
    return pageTitle(view.tournament.name);
  } catch {
    return pageTitle(t("title"));
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PublicTournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations("public");
  const tc = await getTranslations("common");
  const tStatus = await getTranslations("status");
  const tStages = await getTranslations("stages");
  let view;
  try {
    view = await new PublicViewService(getDb()).getBySlug(slug);
  } catch {
    notFound();
  }

  const { tournament } = view;
  const sectionNav = [
    ["schedule", t("schedule")],
    ["results", t("results")],
    ["groups", t("groups")],
    ["standings", t("standings")],
    ["bracket", t("bracket")],
  ] as const;

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-5 text-slate-900 md:py-6">
      <LiveRefresh intervalMs={15_000} />
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("eyebrow")}
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight md:text-3xl">
            {tournament.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {[tournament.location, tournament.timezone, tournament.status]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {tournament.description ? (
            <p className="mt-1 max-w-2xl text-sm leading-snug text-slate-600">
              {tournament.description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-start gap-3">
          <div className="flex flex-col items-end gap-2">
            <LocaleSwitcher compact />
            <Link
              href={`/t/${slug}/live`}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              {t("openLiveBoard")}
            </Link>
          </div>
          {view.qrDataUrl ? (
            <figure className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={view.qrDataUrl}
                alt={t("qrAlt", { url: view.publicUrl })}
                width={96}
                height={96}
                className="mx-auto rounded-md border border-slate-200 bg-white p-1.5"
              />
              <figcaption className="mt-1 max-w-[6.5rem] truncate text-[10px] leading-tight text-slate-500">
                {t("scanFor", { url: view.publicUrl })}
              </figcaption>
            </figure>
          ) : null}
        </div>
      </header>

      <PublicSectionNav
        ariaLabel={t("sectionsNav")}
        items={sectionNav.map(([id, label]) => ({ id, label }))}
      />

      <main className="mt-6 space-y-10">
        <section
          id="schedule"
          aria-labelledby="schedule-heading"
          className="scroll-mt-14"
        >
          <h2 id="schedule-heading" className="text-2xl font-semibold">
            {t("schedule")}
          </h2>
          <MatchTable
            rows={view.schedule}
            empty={t("noScheduledMatches")}
            showWhen
            tc={tc}
            tStatus={tStatus}
            t={t}
          />
        </section>

        <section
          id="results"
          aria-labelledby="results-heading"
          className="scroll-mt-14"
        >
          <h2 id="results-heading" className="text-2xl font-semibold">
            {t("results")}
          </h2>
          <MatchTable
            rows={view.results}
            empty={t("noResults")}
            showScore
            tc={tc}
            tStatus={tStatus}
            t={t}
          />
        </section>

        <section
          id="groups"
          aria-labelledby="groups-heading"
          className="scroll-mt-14"
        >
          <h2 id="groups-heading" className="text-2xl font-semibold">
            {t("groups")}
          </h2>
          {view.groups.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">{t("groupsNotDrawn")}</p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {view.groups.map((group) => (
                <div
                  key={group.id}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <h3 className="font-medium">
                    {group.name}{" "}
                    <span className="text-slate-500">({group.code})</span>
                  </h3>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                    {group.entries.map((e) => (
                      <li key={e.entryId}>{e.displayName}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          id="standings"
          aria-labelledby="standings-heading"
          className="scroll-mt-14"
        >
          <h2 id="standings-heading" className="text-2xl font-semibold">
            {t("standings")}
          </h2>
          {view.standings.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">{t("noStandings")}</p>
          ) : (
            <div className="mt-4 space-y-6">
              {view.standings.map((group) => (
                <div key={group.groupId}>
                  <h3 className="text-lg font-medium">
                    {group.groupName} ·{" "}
                    {localizeStageName(group.stageName, tStages)}
                  </h3>
                  <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead scope="col">{tc("rank")}</TableHead>
                          <TableHead scope="col">{tc("entry")}</TableHead>
                          <TableHead scope="col">{tc("played")}</TableHead>
                          <TableHead scope="col">{tc("wins")}</TableHead>
                          <TableHead scope="col">{tc("losses")}</TableHead>
                          <TableHead scope="col">{tc("setDiff")}</TableHead>
                          <TableHead scope="col">{tc("pointDiff")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.rows.map((row) => (
                          <TableRow key={row.entryId}>
                            <TableCell>{row.rank}</TableCell>
                            <TableCell>{row.displayName}</TableCell>
                            <TableCell>{row.played}</TableCell>
                            <TableCell>{row.wins}</TableCell>
                            <TableCell>{row.losses}</TableCell>
                            <TableCell>{row.setDiff}</TableCell>
                            <TableCell>{row.pointDiff}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          id="bracket"
          aria-labelledby="bracket-heading"
          className="scroll-mt-14"
        >
          <h2 id="bracket-heading" className="text-2xl font-semibold">
            {t("bracket")}
          </h2>
          {view.brackets.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">{t("noBracket")}</p>
          ) : (
            view.brackets.map((bracket) => (
              <div key={bracket.stageId} className="mt-4 space-y-3">
                <h3 className="text-lg font-medium">
                  {localizeStageName(bracket.stageName, tStages)} ·{" "}
                  {t("drawSize", { size: bracket.bracketSize })}
                </h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">{tc("round")}</TableHead>
                        <TableHead scope="col">{tc("match")}</TableHead>
                        <TableHead scope="col">{t("sideA")}</TableHead>
                        <TableHead scope="col">{t("sideB")}</TableHead>
                        <TableHead scope="col">{tc("winner")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bracket.matches.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>{m.roundIndex + 1}</TableCell>
                          <TableCell>{m.matchIndex + 1}</TableCell>
                          <TableCell>
                            {m.isByeA ? tc("bye") : (m.entryAName ?? tc("tbd"))}
                          </TableCell>
                          <TableCell>
                            {m.isByeB ? tc("bye") : (m.entryBName ?? tc("tbd"))}
                          </TableCell>
                          <TableCell>{m.winnerName ?? tc("dash")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))
          )}
        </section>
      </main>

      <footer className="mt-12 border-t border-slate-200 pt-4 text-xs text-slate-500">
        {t("readOnlyFooter")}
      </footer>
    </div>
  );
}

type MatchTableProps = {
  rows: Array<{
    id: string;
    eventName: string;
    entryAName: string | null;
    entryBName: string | null;
    courtCode: string | null;
    scheduledAt: string | null;
    status: string;
    winnerName: string | null;
    sets: Array<{ scoreA: number; scoreB: number }>;
  }>;
  empty: string;
  showWhen?: boolean;
  showScore?: boolean;
  tc: Awaited<ReturnType<typeof getTranslations>>;
  tStatus: Awaited<ReturnType<typeof getTranslations>>;
  t: Awaited<ReturnType<typeof getTranslations>>;
};

function MatchTable({
  rows,
  empty,
  showWhen,
  showScore,
  tc,
  tStatus,
  t,
}: MatchTableProps) {
  if (rows.length === 0) {
    return <p className="mt-3 text-sm text-slate-600">{empty}</p>;
  }
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            {showWhen ? <TableHead scope="col">{tc("when")}</TableHead> : null}
            <TableHead scope="col">{tc("event")}</TableHead>
            <TableHead scope="col">{tc("match")}</TableHead>
            <TableHead scope="col">{tc("court")}</TableHead>
            <TableHead scope="col">{tc("status")}</TableHead>
            {showScore ? <TableHead scope="col">{tc("score")}</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((m) => (
            <TableRow
              key={m.id}
              className={cn(matchStatusRowClass(m.status))}
            >
              {showWhen ? (
                <TableCell className="whitespace-nowrap text-sm">
                  {m.scheduledAt
                    ? new Date(m.scheduledAt).toLocaleString()
                    : tc("dash")}
                </TableCell>
              ) : null}
              <TableCell>{m.eventName}</TableCell>
              <TableCell>
                {m.entryAName ?? tc("tbd")} {tc("vs")} {m.entryBName ?? tc("tbd")}
                {m.winnerName ? (
                  <span className="ml-2 text-xs text-slate-500">
                    {t("winnerColon", { name: m.winnerName })}
                  </span>
                ) : null}
              </TableCell>
              <TableCell>{m.courtCode ?? tc("dash")}</TableCell>
              <TableCell className={cn(matchStatusTextClass(m.status))}>
                {tStatus(matchStatusKey(m.status))}
              </TableCell>
              {showScore ? (
                <TableCell>
                  {m.sets.map((s) => `${s.scoreA}-${s.scoreB}`).join(", ") ||
                    tc("dash")}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
