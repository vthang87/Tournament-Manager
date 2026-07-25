import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TournamentService } from "@/application/services";
import { getDb } from "@/db/client";
import { OrgChartPanel } from "@/features/org-chart/org-chart-panel";
import {
  loadMatchOrgCharts,
  loadTournamentOrgChart,
} from "@/features/org-chart/load-org-chart";
import {
  eventStatusKey,
  stageStatusKey,
  tournamentStatusKey,
} from "@/i18n/status-labels";
import { requireRoleOrRedirect } from "@/lib/auth/require-auth";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const t = await getTranslations("orgChart");
  try {
    const tournament = await new TournamentService(getDb()).getById(
      tournamentId,
    );
    return pageTitle(t("title"), tournament.name);
  } catch {
    return pageTitle(t("title"));
  }
}

export const dynamic = "force-dynamic";

export default async function TournamentOrgChartPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  await requireRoleOrRedirect([
    "ADMIN",
    "OPERATOR",
    "SCOREKEEPER",
    "VIEWER",
  ]);
  const { tournamentId } = await params;
  const db = getDb();
  const t = await getTranslations("orgChart");
  const tStatus = await getTranslations("status");
  const tStages = await getTranslations("stages");
  const tc = await getTranslations("common");
  const tt = await getTranslations("tournaments");

  let tournament;
  try {
    tournament = await new TournamentService(db).getById(tournamentId);
  } catch {
    notFound();
  }

  const labels = {
    tStatus: (key: string) => tStatus(key),
    tStages: (key: string) => tStages(key),
    tOrg: (key: string, values?: Record<string, string | number>) =>
      t(key, values),
    tc: (key: string) => tc(key),
    tournamentStatusKey,
    eventStatusKey,
    stageStatusKey,
  };

  const [structure, matchEvents] = await Promise.all([
    loadTournamentOrgChart(db, tournamentId, labels),
    loadMatchOrgCharts(db, tournamentId, labels),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/tournaments/${tournamentId}`}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← {tournament.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{t("description")}</p>
      </div>

      <OrgChartPanel
        tournamentId={tournamentId}
        structureTree={structure.tree}
        matchEvents={matchEvents}
      />

      <p className="text-xs text-slate-500">
        {tt("slugLabel", { slug: tournament.slug })}
      </p>
    </div>
  );
}
