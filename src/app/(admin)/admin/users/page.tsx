import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { UserManagementService } from "@/application/services";
import { AdminBreadcrumbs } from "@/components/shared/admin-breadcrumbs";
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
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const currentUser = await requireRoleOrRedirect(["SUPER_ADMIN"]);
  const t = await getTranslations("users");
  const tc = await getTranslations("common");
  const managedUsers = await new UserManagementService(getDb()).list(
    { userId: currentUser.id, role: currentUser.role },
    q,
  );

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
          className="h-10 rounded-md border border-slate-200 bg-white px-4 text-sm hover:bg-slate-50"
        >
          {tc("search")}
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
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
    </div>
  );
}
