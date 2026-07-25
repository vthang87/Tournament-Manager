import Link from "next/link";
import { Users, UserRound, Trophy, LayoutDashboard } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { UserRole } from "@/core/domain";
import { canPerform, type PolicyAction } from "@/lib/auth/policies";
import { cn } from "@/lib/utils";

export async function AdminSidebar({
  className,
  role,
}: {
  className?: string;
  role: UserRole;
}) {
  const t = await getTranslations("nav");
  const tMeta = await getTranslations("meta");

  const navItems: {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    requires?: PolicyAction;
  }[] = [
    {
      href: "/admin",
      label: t("dashboard"),
      icon: LayoutDashboard,
      requires: "view",
    },
    {
      href: "/admin/tournaments",
      label: t("tournaments"),
      icon: Trophy,
      requires: "view",
    },
    {
      href: "/admin/clubs",
      label: t("clubs"),
      icon: Users,
      requires: "view",
    },
    {
      href: "/admin/players",
      label: t("players"),
      icon: UserRound,
      requires: "view",
    },
  ];

  const visibleItems = navItems.filter(
    (item) => !item.requires || canPerform(role, item.requires),
  );

  return (
    <aside
      className={cn(
        "flex w-64 flex-col border-r border-slate-200 bg-slate-950 text-slate-100",
        className,
      )}
    >
      <div className="border-b border-slate-800 px-5 py-6">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-emerald-400" aria-hidden />
          <div>
            <p className="text-sm font-semibold tracking-wide">
              {tMeta("appName")}
            </p>
            <p className="text-xs text-slate-400">{t("adminShell")}</p>
          </div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800 hover:text-white"
          >
            <item.icon className="h-4 w-4" aria-hidden />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-slate-800 px-5 py-4 text-xs text-slate-400">
        {t("signedInAs", { role })}
      </div>
    </aside>
  );
}
