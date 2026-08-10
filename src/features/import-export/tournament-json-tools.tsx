"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  exportTournamentJsonAction,
  importTournamentJsonAction,
} from "./tournament-json-actions";

function downloadJson(filename: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (character) =>
    character.charCodeAt(0),
  );
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/json;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function TournamentJsonExportButton({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const t = useTranslations("tournamentJson");
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await exportTournamentJsonAction(tournamentId);
          if (!result.ok) {
            window.alert(result.error);
            return;
          }
          downloadJson(result.data.filename, result.data.base64);
        });
      }}
    >
      {pending ? t("exporting") : t("export")}
    </Button>
  );
}

export function TournamentJsonImportButton() {
  const t = useTranslations("tournamentJson");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        disabled={pending}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (!window.confirm(t("confirmImport", { name: file.name }))) {
            event.target.value = "";
            return;
          }
          const formData = new FormData();
          formData.set("file", file);
          startTransition(async () => {
            const result = await importTournamentJsonAction(formData);
            event.target.value = "";
            if (!result.ok) {
              window.alert(result.error);
              return;
            }
            window.alert(t("importSuccess", { name: result.data.tournamentName }));
            router.push(`/admin/tournaments/${result.data.tournamentId}`);
            router.refresh();
          });
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        {pending ? t("importing") : t("import")}
      </Button>
    </>
  );
}
