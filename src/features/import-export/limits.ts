export const IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MiB
export const IMPORT_MAX_ROWS = 500;
export const EXPORT_MAX_ROWS = 5_000;

export function assertImportFileSize(byteLength: number): void {
  if (byteLength <= 0) {
    throw new Error("Uploaded file is empty.");
  }
  if (byteLength > IMPORT_MAX_FILE_BYTES) {
    throw new Error(
      `File exceeds the ${IMPORT_MAX_FILE_BYTES / (1024 * 1024)} MiB size limit.`,
    );
  }
}

export function assertImportRowCount(rowCount: number): void {
  if (rowCount === 0) {
    throw new Error("Workbook has no data rows.");
  }
  if (rowCount > IMPORT_MAX_ROWS) {
    throw new Error(
      `Workbook has ${rowCount} rows; maximum allowed is ${IMPORT_MAX_ROWS}.`,
    );
  }
}
