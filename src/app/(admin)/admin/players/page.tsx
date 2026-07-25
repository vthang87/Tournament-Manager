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
import { ClubService, PlayerService } from "@/application/services";
import { getDb } from "@/db/client";
import { getCurrentUser } from "@/lib/auth/require-auth";
import { canPerform } from "@/lib/auth/policies";

export const dynamic = "force-dynamic";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const t = await getTranslations("players");
  const tc = await getTranslations("common");
  const db = getDb();
  const [players, clubs] = await Promise.all([
    new PlayerService(db).list(q),
    new ClubService(db).list(),
  ]);
  const clubName = new Map(clubs.map((c) => [c.id, c.name]));
  const user = await getCurrentUser();
  const canImport = user ? canPerform(user.role, "import") : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t("title")}</h2>
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

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder={t("searchPlaceholder")}
          className="flex h-10 w-full max-w-sm rounded-md border border-slate-200 bg-white px-3 text-sm"
        />
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
                  {player.clubId
                    ? (clubName.get(player.clubId) ?? tc("dash"))
                    : tc("dash")}
                </TableCell>
                <TableCell>{player.ranking ?? tc("dash")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
