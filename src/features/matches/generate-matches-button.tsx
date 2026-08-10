"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/features/shared/action-utils";

export function GenerateMatchesButton({
  tournamentId,
  eventId,
  stageId,
  stageName,
  action,
}: {
  tournamentId: string;
  eventId: string;
  stageId: string;
  stageName: string;
  action: (
    tournamentId: string,
    eventId: string,
    stageId: string,
  ) => Promise<ActionResult<{ created: number; skippedExisting: number }>>;
}) {
  const router = useRouter();
  const t = useTranslations("matches");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          setMessage(null);
          startTransition(async () => {
            const result = await action(tournamentId, eventId, stageId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setMessage(
              t("createdMatches", { count: result.data.created }) +
                (result.data.skippedExisting
                  ? t("alreadyExisted", {
                      count: result.data.skippedExisting,
                    })
                  : ""),
            );
            router.refresh();
          });
        }}
      >
        {pending
          ? t("generating")
          : t("generateRRStage", { stageName })}
      </Button>
      {message ? (
        <p className="text-sm text-emerald-800">{message}</p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
