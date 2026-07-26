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
import { ClubService } from "@/application/services";
import { getDb } from "@/db/client";
import { getCurrentUser } from "@/lib/auth/require-auth";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata() {
  const t = await getTranslations("clubs");
  return pageTitle(t("title"));
}

export const dynamic = "force-dynamic";

export default async function ClubsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const t = await getTranslations("clubs");
  const tc = await getTranslations("common");
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }
  const clubs = await new ClubService(getDb()).list(
    { userId: user.id, role: user.role },
    q,
  );
  const canImport = true;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <AdminBreadcrumbs section="clubs" current={t("title")} />
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{t("description")}</p>
        </div>
        {canImport ? (
          <Link
            href="/admin/clubs/new"
            className="inline-flex h-10 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
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
              <TableHead>{tc("name")}</TableHead>
              <TableHead>{tc("shortName")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clubs.map((club) => (
              <TableRow key={club.id}>
                <TableCell>
                  <Link
                    href={`/admin/clubs/${club.id}`}
                    className="font-medium hover:underline"
                  >
                    {club.name}
                  </Link>
                </TableCell>
                <TableCell>{club.shortName ?? tc("dash")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
