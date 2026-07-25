import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EventService, TournamentService } from "@/application/services";
import { getDb } from "@/db/client";
import { ExportWorkbookButtons } from "@/features/import-export/export-workbook-buttons";
import { requireRoleOrRedirect } from "@/lib/auth/require-auth";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tournamentId: string; eventId: string }>;
}) {
  const { tournamentId, eventId } = await params;
  const t = await getTranslations("importExport");
  const db = getDb();
  try {
    await new TournamentService(db).getById(tournamentId);
    const event = await new EventService(db).getById(eventId);
    return pageTitle(t("exportTitle"), event.name);
  } catch {
    return pageTitle(t("exportTitle"));
  }
}

export const dynamic = "force-dynamic";

export default async function EventExportPage({
  params,
}: {
  params: Promise<{ tournamentId: string; eventId: string }>;
}) {
  await requireRoleOrRedirect(["ADMIN", "OPERATOR", "SCOREKEEPER", "VIEWER"]);
  const { tournamentId, eventId } = await params;
  const db = getDb();
  const t = await getTranslations("importExport");

  let tournament;
  let event;
  try {
    tournament = await new TournamentService(db).getById(tournamentId);
    event = await new EventService(db).getById(eventId);
  } catch {
    notFound();
  }
  if (event.tournamentId !== tournamentId) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/tournaments/${tournamentId}/events/${eventId}`}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← {event.name}
        </Link>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {t("exportTitle")}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {tournament.name} · {t("exportSubtitle")}
        </p>
      </div>
      <ExportWorkbookButtons tournamentId={tournamentId} eventId={eventId} />
    </div>
  );
}
