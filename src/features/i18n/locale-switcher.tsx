"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocaleAction } from "@/features/i18n/actions";
import { locales, type AppLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  const t = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div
      className={cn("inline-flex items-center gap-1", className)}
      role="group"
      aria-label={t("language")}
    >
      {!compact ? (
        <span className="mr-1 text-xs text-slate-500">{t("language")}</span>
      ) : null}
      {locales.map((code) => {
        const active = code === locale;
        const label = code === "vi" ? t("vietnamese") : t("english");
        return (
          <button
            key={code}
            type="button"
            disabled={pending || active}
            onClick={() => {
              startTransition(async () => {
                await setLocaleAction(code);
                router.refresh();
              });
            }}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition",
              active
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50",
            )}
            aria-pressed={active}
          >
            {compact ? code.toUpperCase() : label}
          </button>
        );
      })}
    </div>
  );
}
