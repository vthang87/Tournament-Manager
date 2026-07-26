import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminBreadcrumbs } from "@/components/shared/admin-breadcrumbs";
import {
  EventService,
  TournamentService,
} from "@/application/services";
import { getDb } from "@/db/client";
import { eventStatusKey } from "@/i18n/status-labels";
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
    return pageTitle(t("schedule"), tournament.name);
  } catch {
    return pageTitle(t("schedule"));
  }
}

export const dynamic = "force-dynamic";

export default async function TournamentSchedulePage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const db = getDb();
  const t = await getTranslations("tournaments");
  const tStatus = await getTranslations("status");

  let tournament;
  try {
    tournament = await new TournamentService(db).getById(tournamentId);
  } catch {
    notFound();
  }

  const events = await new EventService(db).listByTournament(tournamentId);

  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumbs
          tournament={{ id: tournamentId, name: tournament.name }}
          current={t("schedule")}
        />
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {t("schedule")}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {t("scheduleDescription", { timezone: tournament.timezone })}
        </p>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-slate-600">
          {t("addEventBeforeSchedule")}{" "}
          <Link
            href={`/admin/tournaments/${tournamentId}/events/new`}
            className="underline"
          >
            {t("createEventLink")}
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/admin/tournaments/${tournamentId}/events/${event.id}/schedule`}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium">{event.name}</p>
                  <p className="text-xs text-slate-500">
                    {event.type} · {tStatus(eventStatusKey(event.status))}
                  </p>
                </div>
                <span className="text-xs font-medium text-slate-600">
                  {t("openTimeline")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
