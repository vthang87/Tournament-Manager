"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ExportKind } from "@/application/services/excel-export-service";
import { exportEventWorkbookAction } from "@/features/import-export/actions";

const KINDS: ExportKind[] = [
  "Participants",
  "GroupDraw",
  "Schedule",
  "Results",
  "Standings",
];

const KIND_LABEL_KEYS: Record<
  ExportKind,
  "participants" | "groupDraw" | "schedule" | "results" | "standings"
> = {
  Participants: "participants",
  GroupDraw: "groupDraw",
  Schedule: "schedule",
  Results: "results",
  Standings: "standings",
};

function downloadBase64(filename: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportWorkbookButtons({
  tournamentId,
  eventId,
}: {
  tournamentId: string;
  eventId: string;
}) {
  const t = useTranslations("importExport");
  const [pending, startTransition] = useTransition();

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {KINDS.map((kind) => (
        <li key={kind}>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await exportEventWorkbookAction(
                  tournamentId,
                  eventId,
                  kind,
                );
                if (!result.ok) {
                  window.alert(result.error);
                  return;
                }
                downloadBase64(result.data.filename, result.data.base64);
              });
            }}
          >
            {t("download", { kind: t(KIND_LABEL_KEYS[kind]) })}
          </Button>
        </li>
      ))}
    </ul>
  );
}
