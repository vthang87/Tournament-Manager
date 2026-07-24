"use server";

import { revalidatePath } from "next/cache";
import { ExcelExportService, ExcelImportService } from "@/application/services";
import type { ExportKind } from "@/application/services/excel-export-service";
import { getDb } from "@/db/client";
import type {
  DoublesImportRow,
  SinglesImportRow,
} from "@/features/import-export/parser";
import { withActor } from "@/features/shared/action-utils";

export async function downloadImportTemplateAction(
  eventType: "SINGLES" | "DOUBLES",
) {
  return withActor(async () => {
    const { buildTemplateWorkbook } = await import(
      "@/features/import-export/excel-workbook"
    );
    const buffer = await buildTemplateWorkbook(eventType);
    const filename =
      eventType === "DOUBLES"
        ? "import-doubles-template.xlsx"
        : "import-singles-template.xlsx";
    return {
      filename,
      base64: buffer.toString("base64"),
    };
  });
}

function serializePreview(
  result: Awaited<
    ReturnType<ExcelImportService["previewWorkbook"]>
  >,
) {
  return {
    ...result,
    validRows: result.preview.valid
      .filter(
        (
          r,
        ): r is {
          ok: true;
          rowIndex: number;
          data: SinglesImportRow | DoublesImportRow;
        } => r.ok,
      )
      .map((r) => r.data),
  };
}

export async function previewImportAction(
  tournamentId: string,
  eventId: string,
  formData: FormData,
) {
  return withActor(async (actor) => {
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new Error("Choose an .xlsx file to upload.");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await new ExcelImportService(getDb()).previewWorkbook(
      actor,
      eventId,
      buffer,
    );
    return serializePreview(result);
  });
}

export async function previewGoogleSheetImportAction(
  tournamentId: string,
  eventId: string,
  sheetUrl: string,
) {
  return withActor(async (actor) => {
    const { fetchGoogleSheetWorkbook } = await import(
      "@/features/import-export/google-sheets"
    );
    const { ValidationError } = await import("@/application/errors");
    let buffer: Buffer;
    try {
      buffer = await fetchGoogleSheetWorkbook(sheetUrl);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not download Google Sheet";
      throw new ValidationError(message);
    }
    const result = await new ExcelImportService(getDb()).previewWorkbook(
      actor,
      eventId,
      buffer,
    );
    return serializePreview(result);
  });
}

export async function confirmImportAction(
  tournamentId: string,
  eventId: string,
  rowsJson: string,
) {
  return withActor(async (actor) => {
    const rows = JSON.parse(rowsJson) as Array<
      SinglesImportRow | DoublesImportRow
    >;
    const result = await new ExcelImportService(getDb()).confirmRows(
      actor,
      eventId,
      rows,
    );
    revalidatePath(`/admin/tournaments/${tournamentId}/events/${eventId}`);
    revalidatePath(
      `/admin/tournaments/${tournamentId}/events/${eventId}/entries`,
    );
    return result;
  });
}

export async function exportEventWorkbookAction(
  tournamentId: string,
  eventId: string,
  kind: ExportKind,
) {
  return withActor(async (actor) => {
    const { filename, buffer } = await new ExcelExportService(
      getDb(),
    ).exportEventWorkbook(actor, eventId, kind);
    return {
      filename,
      base64: buffer.toString("base64"),
    };
  });
}

export async function exportTournamentWorkbookAction(
  tournamentId: string,
  kind: ExportKind,
) {
  return withActor(async (actor) => {
    const { filename, buffer } = await new ExcelExportService(
      getDb(),
    ).exportTournamentWorkbook(actor, tournamentId, kind);
    return {
      filename,
      base64: buffer.toString("base64"),
    };
  });
}
