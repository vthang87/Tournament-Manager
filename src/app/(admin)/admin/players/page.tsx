import Link from "next/link";
import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminBreadcrumbs } from "@/components/shared/admin-breadcrumbs";
import { Pagination } from "@/components/shared/pagination";
import { PlayerClubFilter } from "@/features/players/player-club-filter";
import {
  ClubService,
  PlayerService,
  SportService,
} from "@/application/services";
import { getDb } from "@/db/client";
import { getCurrentUser } from "@/lib/auth/require-auth";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata() {
  const t = await getTranslations("players");
  return pageTitle(t("title"));
}

export const dynamic = "force-dynamic";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    sportId?: string;
    clubId?: string;
    page?: string;
  }>;
}) {
  const { q, sportId, clubId, page } = await searchParams;
  const t = await getTranslations("players");
  const tc = await getTranslations("common");
  const db = getDb();
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }
  const actor = { userId: user.id, role: user.role };
  const requestedPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const [playerPage, clubs, sports] = await Promise.all([
    new PlayerService(db).listPage(actor, {
      query: q,
      sportId,
      clubId,
      page: requestedPage,
    }),
    new ClubService(db).list(actor),
    new SportService(db).listActive(),
  ]);
  const players = playerPage.items;
  const clubName = new Map(clubs.map((c) => [c.id, c.name]));
  const canImport = true;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <AdminBreadcrumbs section="players" current={t("title")} />
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{t("description")}</p>
        </div>
        {canImport ? (
          <Link
            href="/admin/players/new"
            className="inline-flex h-8 items-center rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800"
          >
            {t("new")}
          </Link>
        ) : null}
      </div>

      <form className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-2 sm:flex sm:flex-wrap">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder={t("searchPlaceholder")}
          className="col-span-3 flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm sm:col-auto sm:max-w-sm"
        />
        <select
          name="sportId"
          defaultValue={sportId ?? ""}
          className="h-10 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">{t("allSports")}</option>
          {sports.map((sport) => (
            <option key={sport.id} value={sport.id}>
              {sport.name}
            </option>
          ))}
        </select>
        <PlayerClubFilter
          defaultValue={clubId ?? ""}
          clubs={clubs}
          className="min-w-0"
        />
        <button
          type="submit"
          aria-label={tc("search")}
          className="inline-flex size-10 shrink-0 touch-manipulation items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 sm:w-auto sm:px-4 sm:text-sm"
        >
          <Search className="size-4 sm:hidden" aria-hidden="true" />
          <span className="hidden sm:inline">{tc("search")}</span>
        </button>
      </form>

      <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white sm:hidden">
        {players.map((player) => (
          <article key={player.id} className="space-y-3 p-3">
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/admin/players/${player.id}`}
                className="font-semibold text-slate-900 underline-offset-2 hover:underline"
              >
                {player.displayName}
              </Link>
              <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500">
                {player.gender}
              </span>
            </div>

            {player.sports.length > 0 ? (
              <ul className="space-y-2">
                {player.sports.map((profile) => {
                  const sport = sports.find(
                    (item) => item.id === profile.sportId,
                  );
                  return (
                    <li
                      key={profile.sportId}
                      className="flex items-start justify-between gap-3 rounded-md bg-slate-50 px-2.5 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800">
                          {sport?.name ?? profile.sportId}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {profile.clubId
                            ? (clubName.get(profile.clubId) ?? tc("dash"))
                            : tc("dash")}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">
                          {tc("ranking")}
                        </p>
                        <p className="font-semibold tabular-nums text-slate-900">
                          {profile.ranking ?? tc("dash")}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">{tc("dash")}</p>
            )}
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tc("displayName")}</TableHead>
              <TableHead>{tc("gender")}</TableHead>
              <TableHead>{tc("club")}</TableHead>
              <TableHead>{tc("ranking")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((player) => (
              <TableRow key={player.id}>
                <TableCell>
                  <Link
                    href={`/admin/players/${player.id}`}
                    className="font-medium hover:underline"
                  >
                    {player.displayName}
                  </Link>
                </TableCell>
                <TableCell>{player.gender}</TableCell>
                <TableCell>
                  {player.sports
                    .map((profile) =>
                      profile.clubId
                        ? clubName.get(profile.clubId)
                        : null,
                    )
                    .filter(Boolean)
                    .join(", ") || tc("dash")}
                </TableCell>
                <TableCell>
                  {player.sports
                    .map((profile) => {
                      const sport = sports.find(
                        (item) => item.id === profile.sportId,
                      );
                      return `${sport?.name ?? profile.sportId}: ${profile.ranking ?? tc("dash")}`;
                    })
                    .join(" · ")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination
        pathname="/admin/players"
        page={playerPage.page}
        totalPages={playerPage.totalPages}
        totalItems={playerPage.total}
        params={{ q, sportId, clubId }}
      />
    </div>
  );
}
