import { assertImportFileSize } from "./limits";

export type ParsedGoogleSheet = {
  spreadsheetId: string;
  gid: string | null;
};

const ALLOWED_HOSTS = new Set([
  "docs.google.com",
  "spreadsheets.google.com",
]);

/**
 * Accepts a full Sheets edit/view URL or a bare spreadsheet ID.
 * Sheet must be shared as “Anyone with the link” for server-side export.
 */
export function parseGoogleSheetUrl(input: string): ParsedGoogleSheet {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Paste a Google Sheets URL or spreadsheet ID.");
  }

  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return { spreadsheetId: trimmed, gid: null };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Invalid Google Sheets URL.");
  }

  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error(
      "URL must be a Google Sheets link (docs.google.com).",
    );
  }

  const match = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match?.[1]) {
    throw new Error(
      "Could not find spreadsheet ID in the URL. Open the sheet and copy the browser address.",
    );
  }

  const fromQuery = url.searchParams.get("gid");
  const fromHash = url.hash.match(/(?:^|[&#])gid=(\d+)/)?.[1] ?? null;

  return {
    spreadsheetId: match[1],
    gid: fromQuery ?? fromHash,
  };
}

export function buildGoogleSheetExportUrl(parsed: ParsedGoogleSheet): string {
  const url = new URL(
    `https://docs.google.com/spreadsheets/d/${parsed.spreadsheetId}/export`,
  );
  url.searchParams.set("format", "xlsx");
  if (parsed.gid) {
    url.searchParams.set("gid", parsed.gid);
  }
  return url.toString();
}

export async function fetchGoogleSheetWorkbook(
  urlOrId: string,
): Promise<Buffer> {
  const parsed = parseGoogleSheetUrl(urlOrId);
  const exportUrl = buildGoogleSheetExportUrl(parsed);

  let response: Response;
  try {
    response = await fetch(exportUrl, {
      redirect: "follow",
      headers: {
        Accept:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*",
        "User-Agent": "TournamentManager/1.0",
      },
      // Avoid hanging forever on bad network
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    throw new Error(`Could not reach Google Sheets: ${message}`);
  }

  if (!response.ok) {
    throw new Error(
      `Could not download sheet (HTTP ${response.status}). Share it as “Anyone with the link can view”, then try again.`,
    );
  }

  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (contentType.includes("text/html")) {
    throw new Error(
      "Google returned a login/HTML page instead of a spreadsheet. Share the sheet as “Anyone with the link can view”.",
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  assertImportFileSize(buffer.byteLength);

  // XLSX is a ZIP — starts with PK
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new Error(
      "Downloaded file is not a valid Excel workbook. Check the URL, tab (gid), and sharing settings.",
    );
  }

  return buffer;
}
