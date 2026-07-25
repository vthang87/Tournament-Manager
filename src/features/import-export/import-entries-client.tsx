"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  confirmImportAction,
  downloadImportTemplateAction,
  previewGoogleSheetImportAction,
  previewImportAction,
} from "@/features/import-export/actions";
import type {
  DoublesImportRow,
  SinglesImportRow,
} from "@/features/import-export/parser";
import type { ActionResult } from "@/features/shared/action-utils";

type PreviewState = {
  eventType: "SINGLES" | "DOUBLES";
  validRows: Array<SinglesImportRow | DoublesImportRow>;
  invalid: Array<{ rowIndex: number; errors: string[] }>;
  summary: {
    total: number;
    validCount: number;
    invalidCount: number;
    duplicateSeeds: number[];
  };
};

type PreviewPayload = {
  eventType: "SINGLES" | "DOUBLES";
  validRows: Array<SinglesImportRow | DoublesImportRow>;
  preview: {
    invalid: Array<{ rowIndex: number; errors: string[] }>;
    summary: PreviewState["summary"];
  };
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

function toPreviewState(data: PreviewPayload): PreviewState {
  return {
    eventType: data.eventType,
    validRows: data.validRows,
    invalid: data.preview.invalid.map((r) => ({
      rowIndex: r.rowIndex,
      errors: r.errors,
    })),
    summary: data.preview.summary,
  };
}

export function ImportEntriesClient({
  tournamentId,
  eventId,
  eventType,
}: {
  tournamentId: string;
  eventId: string;
  eventType: string;
}) {
  const t = useTranslations("importExport");
  const tCommon = useTranslations("common");
  const tEntries = useTranslations("entries");
  const tEvents = useTranslations("events");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const importKind =
    eventType === "DOUBLES" ? ("DOUBLES" as const) : ("SINGLES" as const);
  const eventTypeLabel =
    eventType === "DOUBLES" ? tEvents("typeDoubles") : tEvents("typeSingles");
  const canImport = eventType === "SINGLES" || eventType === "DOUBLES";

  function applyPreviewResult(result: ActionResult<PreviewPayload>) {
    if (!result.ok) {
      setError(result.error);
      setPreview(null);
      return;
    }
    setPreview(toPreviewState(result.data));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending || !canImport}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await downloadImportTemplateAction(importKind);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              downloadBase64(result.data.filename, result.data.base64);
            });
          }}
        >
          {t("downloadTemplate")}
        </Button>
        <p className="text-sm text-slate-600">{t("downloadTemplateHint")}</p>
      </div>

      <form
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          setError(null);
          setMessage(null);
          startTransition(async () => {
            const result = await previewImportAction(
              tournamentId,
              eventId,
              formData,
            );
            applyPreviewResult(result);
          });
        }}
      >
        <h3 className="text-sm font-medium text-slate-900">{t("fromExcel")}</h3>
        <p className="text-sm text-slate-600">
          {t("uploadHint1")}{" "}
          <strong>{eventTypeLabel}</strong>:{" "}
          {eventType === "DOUBLES"
            ? t("uploadHintDoubles")
            : t("uploadHintSingles")}
          {t("uploadHint2")}
        </p>
        <input
          type="file"
          name="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          className="block w-full text-sm"
        />
        <Button type="submit" disabled={pending || !canImport}>
          {pending ? t("parsing") : t("uploadPreview")}
        </Button>
      </form>

      <form
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setMessage(null);
          startTransition(async () => {
            const result = await previewGoogleSheetImportAction(
              tournamentId,
              eventId,
              sheetUrl,
            );
            applyPreviewResult(result);
          });
        }}
      >
        <h3 className="text-sm font-medium text-slate-900">
          {t("fromGoogleSheet")}
        </h3>
        <p className="text-sm text-slate-600">{t("googleSheetHint")}</p>
        <div className="space-y-1.5">
          <Label htmlFor="sheetUrl">{t("googleSheetUrl")}</Label>
          <Input
            id="sheetUrl"
            name="sheetUrl"
            type="text"
            required
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder={t("googleSheetPlaceholder")}
          />
        </div>
        <Button type="submit" disabled={pending || !canImport || !sheetUrl.trim()}>
          {pending ? t("parsing") : t("previewGoogleSheet")}
        </Button>
      </form>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-700" role="status">
          {message}
        </p>
      ) : null}

      {preview ? (
        <div className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <p>
              {t("validSummary", {
                valid: preview.summary.validCount,
                invalid: preview.summary.invalidCount,
                total: preview.summary.total,
              })}
            </p>
            {preview.summary.duplicateSeeds.length > 0 ? (
              <p className="mt-1 text-amber-800">
                {t("duplicateSeeds", {
                  seeds: preview.summary.duplicateSeeds.join(", "),
                })}
              </p>
            ) : null}
          </div>

          {preview.invalid.length > 0 ? (
            <div>
              <h3 className="text-lg font-medium">{t("rowErrors")}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
                {preview.invalid.map((row) => (
                  <li key={row.rowIndex}>
                    {t("rowError", {
                      row: row.rowIndex + 2,
                      errors: row.errors.join("; "),
                    })}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <h3 className="text-lg font-medium">{t("validPreview")}</h3>
            <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tEntries("displayName")}</TableHead>
                    <TableHead>{tEntries("club")}</TableHead>
                    <TableHead>{tEntries("seed")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.validRows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.displayName}</TableCell>
                      <TableCell>
                        {"clubName" in row
                          ? (row.clubName ?? tCommon("dash"))
                          : tCommon("dash")}
                      </TableCell>
                      <TableCell>{row.seed ?? tCommon("dash")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <Button
            type="button"
            disabled={
              pending ||
              preview.validRows.length === 0 ||
              preview.invalid.length > 0 ||
              preview.summary.duplicateSeeds.length > 0
            }
            onClick={() => {
              setError(null);
              setMessage(null);
              startTransition(async () => {
                const result = await confirmImportAction(
                  tournamentId,
                  eventId,
                  JSON.stringify(preview.validRows),
                );
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setMessage(
                  t("imported", {
                    count: result.data.createdEntryIds.length,
                  }),
                );
                setPreview(null);
              });
            }}
          >
            {pending ? t("importing") : t("confirmImport")}
          </Button>
          <p className="text-xs text-slate-500">{t("confirmHint")}</p>
        </div>
      ) : null}
    </div>
  );
}
