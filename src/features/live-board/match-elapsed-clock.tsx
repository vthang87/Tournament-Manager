"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

function formatStartTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function elapsedMinutes(startedAt: string, nowMs: number): number {
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((nowMs - start) / 60_000));
}

/** Start time + live elapsed minutes for IN_PROGRESS matches. */
export function MatchElapsedClock({
  startedAt,
  className,
  compact,
}: {
  startedAt: string | null | undefined;
  className?: string;
  compact?: boolean;
}) {
  const t = useTranslations("liveBoard");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  if (!startedAt) {
    return (
      <p className={cn("text-slate-500", className)}>{t("startTimeUnknown")}</p>
    );
  }

  const mins = elapsedMinutes(startedAt, now);
  const startLabel = formatStartTime(startedAt);

  if (compact) {
    return (
      <p className={cn("tabular-nums text-slate-500", className)}>
        {t("startedAt", { time: startLabel })} · {t("elapsedMinutes", { mins })}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-lg",
        className,
      )}
    >
      <p className="text-slate-300">
        <span className="mr-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {t("startTime")}
        </span>
        <span className="tabular-nums font-medium text-white">{startLabel}</span>
      </p>
      <p className="text-amber-200">
        <span className="mr-2 text-xs font-semibold uppercase tracking-wider text-amber-400/80">
          {t("elapsed")}
        </span>
        <span className="tabular-nums font-semibold">
          {t("elapsedMinutes", { mins })}
        </span>
      </p>
    </div>
  );
}
