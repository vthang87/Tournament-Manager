"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  Trophy,
  UserCog,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/core/domain";
import { logoutAction } from "@/features/auth/actions";
import { canPerform, type PolicyAction } from "@/lib/auth/policies";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  requires?: PolicyAction;
  superAdminOnly?: boolean;
};

export function AdminMobileMenu({ role }: { role: UserRole }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");

  const navItems: NavItem[] = [
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
    {
      href: "/admin/users",
      label: t("users"),
      icon: UserCog,
      superAdminOnly: true,
    },
  ];

  const visibleItems = navItems.filter(
    (item) =>
      (!item.requires || canPerform(role, item.requires)) &&
      (!item.superAdminOnly || role === "SUPER_ADMIN"),
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    let closeTimer: number | undefined;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      closeTimer = window.setTimeout(() => {
        if (dialog.open) {
          dialog.close();
        }
      }, 240);
    }

    return () => {
      if (closeTimer !== undefined) {
        window.clearTimeout(closeTimer);
      }
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={t("openMenu")}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 md:hidden"
      >
        <Menu className="size-4.5" aria-hidden="true" />
      </button>

      <dialog
        ref={dialogRef}
        data-state={open ? "open" : "closed"}
        aria-label={t("menu")}
        className="admin-mobile-menu fixed inset-y-0 left-0 z-50 m-0 h-dvh max-h-none w-[min(20rem,calc(100vw-3rem))] max-w-none border-0 bg-slate-950 p-0 text-slate-100 shadow-2xl md:hidden"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            setOpen(false);
          }
        }}
      >
        <div className="flex min-h-dvh flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-slate-900 text-emerald-400">
                <Trophy className="size-4.5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">Tournament Manager</p>
                <p className="text-xs text-slate-400">{t("adminShell")}</p>
              </div>
            </div>
            <button
              type="button"
              aria-label={t("closeMenu")}
              onClick={() => setOpen(false)}
              className="flex size-10 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-1 p-3">
            {visibleItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/admin" &&
                  pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500",
                    active
                      ? "bg-slate-800 text-white"
                      : "text-slate-300 hover:bg-slate-900 hover:text-white",
                  )}
                >
                  <item.icon className="size-4.5" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-slate-800 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              >
                <LogOut className="size-4.5" aria-hidden="true" />
                {tAuth("logOut")}
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
