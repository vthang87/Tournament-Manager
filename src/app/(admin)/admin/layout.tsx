import { getTranslations } from "next-intl/server";
import { AdminSidebar } from "@/components/shared/admin-sidebar";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/features/auth/actions";
import { LocaleSwitcher } from "@/features/i18n/locale-switcher";
import { requireAuthOrRedirect } from "@/lib/auth/require-auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuthOrRedirect("/login");
  const t = await getTranslations("nav");
  const tAuth = await getTranslations("auth");
  const tMeta = await getTranslations("meta");

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <AdminSidebar role={user.role} className="hidden md:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("operations")}
            </p>
            <h1 className="text-lg font-semibold">{tMeta("appName")}</h1>
          </div>
          <div className="flex items-center gap-3">
            <LocaleSwitcher compact />
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">
                {user.displayName}
              </p>
              <p className="text-xs text-slate-500">
                {user.username} · {user.role}
              </p>
            </div>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                {tAuth("logOut")}
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
