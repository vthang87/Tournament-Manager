"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { DrawSession } from "@/core/domain";
import { drawSessionStatusKey } from "@/i18n/status-labels";

export function DrawHistoryList({
  tournamentId,
  eventId,
  sessions,
  activeSessionId,
}: {
  tournamentId: string;
  eventId: string;
  sessions: DrawSession[];
  activeSessionId?: string | null;
}) {
  const t = useTranslations("draw");
  const tStatus = useTranslations("status");
  const base = `/admin/tournaments/${tournamentId}/events/${eventId}/draw`;

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-slate-500">{t("noSessionsYet")}</p>
    );
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {sessions.map((session) => {
        const href =
          session.status === "DRAFT"
            ? base
            : `${base}/history?sessionId=${session.id}`;
        const isActive = session.id === activeSessionId;
        const statusLabel = tStatus(drawSessionStatusKey(session.status));
        return (
          <li key={session.id}>
            <Link
              href={href}
              className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-slate-50 ${
                isActive ? "bg-slate-50" : ""
              }`}
            >
              <div>
                <p className="font-medium text-slate-900">
                  {t("sessionSeedLine", {
                    status: statusLabel,
                    seed: session.randomSeed,
                  })}
                </p>
                <p className="text-xs text-slate-500">
                  {t("created", { date: session.createdAt })}
                  {session.confirmedAt
                    ? t("confirmedAt", { date: session.confirmedAt })
                    : ""}
                </p>
              </div>
              <span className="text-xs font-medium text-slate-600">
                {session.status === "DRAFT"
                  ? t("openDraft")
                  : t("replayLink")}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
