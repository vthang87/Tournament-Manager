import Link from "next/link";
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
  searchParams: Promise<{ q?: string; sportId?: string }>;
}) {
  const { q, sportId } = await searchParams;
  const t = await getTranslations("players");
  const tc = await getTranslations("common");
  const db = getDb();
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }
  const actor = { userId: user.id, role: user.role };
  const [players, clubs, sports] = await Promise.all([
    new PlayerService(db).list(actor, q, sportId),
    new ClubService(db).list(actor),
    new SportService(db).listActive(),
  ]);
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

      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder={t("searchPlaceholder")}
          className="flex h-10 w-full max-w-sm rounded-md border border-slate-200 bg-white px-3 text-sm"
        />
        <select
          name="sportId"
          defaultValue={sportId ?? ""}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">Tất cả môn</option>
          {sports.map((sport) => (
            <option key={sport.id} value={sport.id}>
              {sport.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 rounded-md border border-slate-200 bg-white px-4 text-sm hover:bg-slate-50"
        >
          {tc("search")}
        </button>
      </form>

      <div className="rounded-lg border border-slate-200 bg-white">
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
    </div>
  );
}
