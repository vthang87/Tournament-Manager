import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CourtService,
  EventService,
  TournamentService,
} from "@/application/services";
import { getDb } from "@/db/client";
import { archiveTournamentAction, advanceTournamentAction } from "@/features/tournaments/actions";
import { getCurrentUser } from "@/lib/auth/require-auth";
import { canPerform } from "@/lib/auth/policies";
import type { TournamentStatus } from "@/core/domain";
import {
  eventStatusKey,
  tournamentStatusKey,
} from "@/i18n/status-labels";
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
    return pageTitle(tournament.name);
  } catch {
    return pageTitle(t("title"));
  }
}

export const dynamic = "force-dynamic";

const NEXT_STATUS: Partial<Record<TournamentStatus, TournamentStatus>> = {
  DRAFT: "REGISTRATION",
  REGISTRATION: "DRAW",
  DRAW: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
};

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const db = getDb();
  const tournamentService = new TournamentService(db);
  const t = await getTranslations("tournaments");
  const te = await getTranslations("events");
  const tc = await getTranslations("common");
  const tStatus = await getTranslations("status");

  let tournament;
  try {
    tournament = await tournamentService.getById(tournamentId);
  } catch {
    notFound();
  }

  const events = await new EventService(db).listByTournament(tournamentId);
  const courts = await new CourtService(db).listByTournament(tournamentId);
  const user = await getCurrentUser();
  const canSetup = user ? canPerform(user.role, "setup") : false;
  const canArchive = user ? canPerform(user.role, "archive") : false;
  const nextStatus = NEXT_STATUS[tournament.status];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/tournaments"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            ← {t("title")}
          </Link>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {tournament.name}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {tournament.location ?? tc("noLocation")} · {tournament.timezone} ·{" "}
            <span className="font-medium text-slate-800">
              {tStatus(tournamentStatusKey(tournament.status))}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSetup ? (
            <Link
              href={`/admin/tournaments/${tournamentId}/edit`}
              className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm hover:bg-slate-50"
            >
              {tc("edit")}
            </Link>
          ) : null}
          {canSetup && nextStatus ? (
            <form
              action={async () => {
                "use server";
                await advanceTournamentAction(
                  tournamentId,
                  nextStatus as "REGISTRATION" | "DRAW" | "IN_PROGRESS" | "COMPLETED",
                );
              }}
            >
              <Button type="submit" size="sm" variant="secondary">
                {t("advanceTo", {
                  status: tStatus(tournamentStatusKey(nextStatus)),
                })}
              </Button>
            </form>
          ) : null}
          {canArchive && tournament.status !== "ARCHIVED" ? (
            <form
              action={async () => {
                "use server";
                await archiveTournamentAction(tournamentId);
              }}
            >
              <Button type="submit" size="sm" variant="outline">
                {t("archive")}
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{te("title")}</CardTitle>
            <CardDescription>
              {t("configured", { count: events.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/admin/tournaments/${tournamentId}/events/new`}
              className="text-sm font-medium text-slate-900 underline"
            >
              {t("addEvent")}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("courts")}</CardTitle>
            <CardDescription>
              {t("courtsCount", { count: courts.length })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href={`/admin/tournaments/${tournamentId}/courts`}
              className="block text-sm font-medium text-slate-900 underline"
            >
              {t("manageCourts")}
            </Link>
            <Link
              href={`/admin/tournaments/${tournamentId}/courts/live`}
              className="block text-sm font-medium text-slate-900 underline"
            >
              {t("courtLiveBoard")}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("boards")}</CardTitle>
            <CardDescription>{t("opsAndPublic")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href={`/admin/tournaments/${tournamentId}/org-chart`}
              className="block text-sm font-medium text-slate-900 underline"
            >
              {t("orgChart")}
            </Link>
            <Link
              href={`/t/${tournament.slug}/live`}
              className="block text-sm font-medium text-slate-900 underline"
            >
              {t("tvLiveBoard")}
            </Link>
            <Link
              href={`/t/${tournament.slug}`}
              className="block text-sm font-medium text-slate-900 underline"
            >
              {t("publicSlug", { slug: tournament.slug })}
            </Link>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">{te("title")}</h3>
        {events.length === 0 ? (
          <p className="text-sm text-slate-600">{t("noEventsYet")}</p>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/admin/tournaments/${tournamentId}/events/${event.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium">{event.name}</p>
                  <p className="text-xs text-slate-500">
                    {event.type} · {event.genderCategory}
                  </p>
                </div>
                <span className="text-xs font-medium text-slate-600">
                  {tStatus(eventStatusKey(event.status))}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
