/**
 * Excel formula-injection helpers.
 * Leading = + - @ can turn cell values into formulas when opened in Excel.
 */

const FORMULA_PREFIX = /^[=+\-@]/;

export function sanitizeImportText(value: unknown): string {
  const raw = String(value ?? "")
    .replace(/\u0000/g, "")
    .trim();
  // Strip one or more leading formula trigger characters after optional whitespace.
  return raw.replace(/^(?:[=+\-@])+/, "").trim();
}

export function escapeExcelCell(value: string | number | null | undefined): string {
  if (value == null) {
    return "";
  }
  const text = String(value);
  if (FORMULA_PREFIX.test(text)) {
    return `'${text}`;
  }
  return text;
}

export function cellLooksLikeFormula(value: unknown): boolean {
  return FORMULA_PREFIX.test(String(value ?? "").trim());
}
