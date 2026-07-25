import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TournamentService } from "@/application/services";
import { getDb } from "@/db/client";
import { requireRoleOrRedirect } from "@/lib/auth/require-auth";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const t = await getTranslations("tournaments");
  try {
    const tournament = await new TournamentService(getDb()).getById(tournamentId);
    return pageTitle(t("liveBoard"), tournament.name);
  } catch {
    return pageTitle(t("liveBoard"));
  }
}

export const dynamic = "force-dynamic";

/** Admin bookmark → public live board. */
export default async function TournamentLiveBoardRedirectPage({
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

  let tournament;
  try {
    tournament = await new TournamentService(getDb()).getById(tournamentId);
  } catch {
    notFound();
  }

  redirect(`/t/${tournament.slug}/live`);
}
