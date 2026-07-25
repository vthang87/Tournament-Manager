import { notFound } from "next/navigation";
import { CourtScorePanel } from "@/features/court-scoring/court-score-panel";
import { loadCourtScoringBoard } from "@/features/court-scoring/load-board";
import { CourtUnlockForm } from "@/features/court-scoring/unlock-form";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; code: string }>;
}) {
  const { slug, code } = await params;
  try {
    const board = await loadCourtScoringBoard(slug, code);
    return pageTitle(board.court.name, board.tournamentName);
  } catch {
    return pageTitle(code);
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CourtRefereePage({
  params,
}: {
  params: Promise<{ slug: string; code: string }>;
}) {
  const { slug, code } = await params;
  let board;
  try {
    board = await loadCourtScoringBoard(slug, code);
  } catch {
    notFound();
  }

  if (!board.unlocked) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <CourtUnlockForm
          slug={slug}
          code={code}
          courtName={board.court.name}
          tournamentName={board.tournamentName}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <CourtScorePanel
        slug={slug}
        code={code}
        courtName={board.court.name}
        tournamentName={board.tournamentName}
        inProgress={board.inProgress}
        queue={board.queue}
        entryLabels={board.entryLabels}
        entryClubs={board.entryClubs}
      />
    </div>
  );
}
