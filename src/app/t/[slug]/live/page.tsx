import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DashboardService } from "@/application/services";
import { getDb } from "@/db/client";
import { DrizzleTournamentRepository } from "@/db/repositories/tournament-repository";
import { LiveBoardRealtime } from "@/features/live-board/live-board-realtime";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations("tournaments");
  const tournament = await new DrizzleTournamentRepository(getDb()).findBySlug(slug);
  if (!tournament) {
    return pageTitle(t("liveBoard"));
  }
  return pageTitle(t("liveBoard"), tournament.name);
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Public TV live board — no login required. */
export default async function PublicLiveBoardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = getDb();
  const tournament = await new DrizzleTournamentRepository(db).findBySlug(slug);
  if (!tournament) {
    notFound();
  }

  const board = await new DashboardService(db).liveBoard(tournament.id);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <LiveBoardRealtime
        tournamentSlug={tournament.slug}
        tournamentName={tournament.name}
        initialBoard={board}
      />
    </div>
  );
}
