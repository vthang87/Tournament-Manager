import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TournamentService } from "@/application/services";
import { getDb } from "@/db/client";
import { getCurrentUser } from "@/lib/auth/require-auth";
import { canPerform } from "@/lib/auth/policies";
import { tournamentStatusKey } from "@/i18n/status-labels";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata() {
  const t = await getTranslations("tournaments");
  return pageTitle(t("title"));
}

export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const t = await getTranslations("tournaments");
  const tc = await getTranslations("common");
  const tStatus = await getTranslations("status");
  const tournaments = await new TournamentService(getDb()).list();
  const user = await getCurrentUser();
  const canSetup = user ? canPerform(user.role, "setup") : false;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t("title")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("listDescription")}</p>
        </div>
        {canSetup ? (
          <Link
            href="/admin/tournaments/new"
            className="inline-flex h-10 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
          >
            {t("new")}
          </Link>
        ) : null}
      </div>

      {tournaments.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-600">
            {t("noTournamentsYet")}
            {canSetup ? (
              <>
                {" "}
                <Link
                  href="/admin/tournaments/new"
                  className="font-medium text-slate-900 underline"
                >
                  {t("createFirstOne")}
                </Link>
                .
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tournaments.map((tournament) => (
            <Card key={tournament.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>
                    <Link
                      href={`/admin/tournaments/${tournament.id}`}
                      className="hover:underline"
                    >
                      {tournament.name}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    {tournament.location ?? tc("noLocation")} ·{" "}
                    {tournament.startDate ?? tc("tbd")} →{" "}
                    {tournament.endDate ?? tc("tbd")}
                  </CardDescription>
                </div>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                  {tStatus(tournamentStatusKey(tournament.status))}
                </span>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                {t("slugLabel", { slug: tournament.slug })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
