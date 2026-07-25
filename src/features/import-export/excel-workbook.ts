import ExcelJS from "exceljs";
import {
  assertImportFileSize,
  assertImportRowCount,
} from "./limits";
import { sanitizeImportText } from "./sanitize";
import {
  previewDoublesImport,
  previewSinglesImport,
  type DoublesImportRow,
  type ImportPreviewResult,
  type SinglesImportRow,
} from "./parser";

export type EventImportKind = "SINGLES" | "DOUBLES";

const SINGLES_HEADERS = ["Player Name", "Club", "Seed"] as const;
const DOUBLES_HEADERS = ["Player 1", "Player 2", "Club", "Seed"] as const;

function normalizeHeader(value: unknown): string {
  return sanitizeImportText(value).toLowerCase().replace(/\s+/g, " ");
}

function headerMap(row: ExcelJS.Row): Map<string, number> {
  const map = new Map<string, number>();
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = normalizeHeader(cellValueToString(cell.value));
    if (key) {
      map.set(key, colNumber);
    }
  });
  return map;
}

function cellValueToString(value: ExcelJS.CellValue): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object" && "text" in value && value.text != null) {
    return String(value.text);
  }
  if (typeof value === "object" && "result" in value) {
    return cellValueToString(value.result as ExcelJS.CellValue);
  }
  return String(value);
}

function readCell(
  row: ExcelJS.Row,
  headers: Map<string, number>,
  label: string,
): string {
  const col = headers.get(normalizeHeader(label));
  if (!col) {
    return "";
  }
  return sanitizeImportText(cellValueToString(row.getCell(col).value));
}

function readSeed(
  row: ExcelJS.Row,
  headers: Map<string, number>,
): number | undefined {
  const raw = readCell(row, headers, "Seed");
  if (!raw) {
    return undefined;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : Number.NaN;
}

export async function parseEntriesWorkbook(
  buffer: ArrayBuffer | Buffer,
  eventType: EventImportKind,
): Promise<ImportPreviewResult<SinglesImportRow | DoublesImportRow>> {
  assertImportFileSize(buffer.byteLength);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("Workbook has no worksheets.");
  }

  const headerRow = sheet.getRow(1);
  const headers = headerMap(headerRow);
  const required =
    eventType === "SINGLES" ? SINGLES_HEADERS : DOUBLES_HEADERS;
  for (const label of required) {
    if (label === "Club" || label === "Seed") {
      continue; // optional columns
    }
    if (!headers.has(normalizeHeader(label))) {
      throw new Error(
        `Missing required column "${label}". Expected: ${required.join(", ")}.`,
      );
    }
  }

  const rawRows: unknown[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }
    if (eventType === "SINGLES") {
      const playerName = readCell(row, headers, "Player Name");
      const clubName = readCell(row, headers, "Club") || undefined;
      const seed = readSeed(row, headers);
      if (!playerName && !clubName && (seed == null || Number.isNaN(seed))) {
        return;
      }
      rawRows.push({
        displayName: playerName,
        playerName,
        playerDisplayName: playerName,
        clubName,
        seed: seed != null && !Number.isNaN(seed) ? seed : undefined,
      });
    } else {
      const player1Name = readCell(row, headers, "Player 1");
      const player2Name = readCell(row, headers, "Player 2");
      const clubName = readCell(row, headers, "Club") || undefined;
      const seed = readSeed(row, headers);
      if (
        !player1Name &&
        !player2Name &&
        !clubName &&
        (seed == null || Number.isNaN(seed))
      ) {
        return;
      }
      const displayName =
        player1Name && player2Name
          ? `${player1Name} / ${player2Name}`
          : player1Name || player2Name;
      rawRows.push({
        displayName,
        player1Name,
        player2Name,
        clubName,
        seed: seed != null && !Number.isNaN(seed) ? seed : undefined,
      });
    }
  });

  assertImportRowCount(rawRows.length);

  return eventType === "SINGLES"
    ? previewSinglesImport(rawRows)
    : previewDoublesImport(rawRows);
}

export async function buildTemplateWorkbook(
  eventType: EventImportKind,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(
    eventType === "SINGLES" ? "Singles" : "Doubles",
  );
  const headers =
    eventType === "SINGLES" ? [...SINGLES_HEADERS] : [...DOUBLES_HEADERS];
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };

  if (eventType === "SINGLES") {
    sheet.addRow(["Nguyễn Văn A", "CLB Quận 1", 1]);
    sheet.addRow(["Trần Thị B", "CLB Quận 3", 2]);
    sheet.addRow(["Lê Minh C", "", ""]);
  } else {
    sheet.addRow(["Nguyễn Văn A", "Trần Văn B", "CLB Quận 1", 1]);
    sheet.addRow(["Phạm Quốc D", "Hoàng Thị E", "CLB Quận 3", 2]);
    sheet.addRow(["Võ Minh F", "Đặng Thị G", "", ""]);
  }

  headers.forEach((_, i) => {
    sheet.getColumn(i + 1).width = 22;
  });

  const note = workbook.addWorksheet("Huong dan");
  note.addRow(["Giữ nguyên dòng header (tiếng Anh)."]);
  note.addRow([
    eventType === "SINGLES"
      ? "Cột: Player Name | Club (tuỳ chọn) | Seed (tuỳ chọn)"
      : "Cột: Player 1 | Player 2 | Club (tuỳ chọn) | Seed (tuỳ chọn)",
  ]);
  note.addRow(["Xóa các dòng mẫu trước khi nhập dữ liệu thật."]);
  note.addRow(["Tối đa 500 dòng / 2 MiB."]);
  note.getColumn(1).width = 72;

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

export async function buildWorkbook(
  sheetName: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow(row.map((cell) => (cell == null ? "" : cell)));
  }
  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}
