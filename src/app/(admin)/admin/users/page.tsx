import Link from "next/link";
import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { UserManagementService } from "@/application/services";
import { AdminBreadcrumbs } from "@/components/shared/admin-breadcrumbs";
import { Pagination } from "@/components/shared/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDb } from "@/db/client";
import { requireRoleOrRedirect } from "@/lib/auth/require-auth";
import { pageTitle } from "@/lib/page-title";

export async function generateMetadata() {
  const t = await getTranslations("users");
  return pageTitle(t("title"));
}

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const currentUser = await requireRoleOrRedirect(["SUPER_ADMIN"]);
  const t = await getTranslations("users");
  const tc = await getTranslations("common");
  const requestedPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const managedUserPage = await new UserManagementService(getDb()).listPage(
    { userId: currentUser.id, role: currentUser.role },
    { query: q, page: requestedPage },
  );
  const managedUsers = managedUserPage.items;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <AdminBreadcrumbs section="users" current={t("title")} />
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{t("description")}</p>
        </div>
        <Link
          href="/admin/users/new"
          className="inline-flex h-10 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t("new")}
        </Link>
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
          aria-label={tc("search")}
          className="inline-flex size-10 shrink-0 touch-manipulation items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 sm:w-auto sm:px-4 sm:text-sm"
        >
          <Search className="size-4 sm:hidden" aria-hidden="true" />
          <span className="hidden sm:inline">{tc("search")}</span>
        </button>
      </form>

      <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white sm:hidden">
        {managedUsers.map((user) => (
          <article key={user.id} className="space-y-2.5 p-3">
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/admin/users/${user.id}`}
                className="font-semibold text-slate-900 underline-offset-2 hover:underline"
              >
                @{user.username}
              </Link>
              <span
                className={
                  user.active
                    ? "inline-flex shrink-0 items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                    : "inline-flex shrink-0 items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500"
                }
              >
                {user.active ? t("active") : t("inactive")}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">
                {user.displayName}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {t(`roles.${user.role}`)}
              </p>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("username")}</TableHead>
              <TableHead>{t("displayName")}</TableHead>
              <TableHead>{t("role")}</TableHead>
              <TableHead>{t("status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {managedUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="font-medium hover:underline"
                  >
                    @{user.username}
                  </Link>
                </TableCell>
                <TableCell>{user.displayName}</TableCell>
                <TableCell>{t(`roles.${user.role}`)}</TableCell>
                <TableCell>
                  <span
                    className={
                      user.active
                        ? "text-emerald-700"
                        : "text-slate-500"
                    }
                  >
                    {user.active ? t("active") : t("inactive")}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination
        pathname="/admin/users"
        page={managedUserPage.page}
        totalPages={managedUserPage.totalPages}
        totalItems={managedUserPage.total}
        params={{ q }}
      />
    </div>
  );
}
