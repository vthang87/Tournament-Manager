import { z } from "zod";

/** Shared import row shapes (Excel binary import comes later). */

export const singlesImportRowSchema = z.object({
  displayName: z.string().trim().min(1),
  playerName: z.string().trim().min(1),
  playerDisplayName: z.string().trim().min(1).optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNSPECIFIED"]).optional(),
  clubName: z.string().trim().min(1).optional(),
  seed: z.coerce.number().int().positive().optional(),
  ranking: z.coerce.number().int().positive().optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().optional(),
});

export const doublesImportRowSchema = z.object({
  displayName: z.string().trim().min(1),
  player1Name: z.string().trim().min(1),
  player1DisplayName: z.string().trim().min(1).optional(),
  player2Name: z.string().trim().min(1),
  player2DisplayName: z.string().trim().min(1).optional(),
  clubName: z.string().trim().min(1).optional(),
  seed: z.coerce.number().int().positive().optional(),
  ranking: z.coerce.number().int().positive().optional(),
});

export type SinglesImportRow = z.infer<typeof singlesImportRowSchema>;
export type DoublesImportRow = z.infer<typeof doublesImportRowSchema>;

export type ImportRowPreview<T> =
  | { ok: true; rowIndex: number; data: T }
  | { ok: false; rowIndex: number; errors: string[]; raw: unknown };

export type ImportPreviewResult<T> = {
  valid: ImportRowPreview<T & { ok: true } extends never ? T : T>[];
  invalid: Extract<ImportRowPreview<T>, { ok: false }>[];
  summary: {
    total: number;
    validCount: number;
    invalidCount: number;
    duplicateSeeds: number[];
  };
};

function previewRows<T>(
  schema: z.ZodType<T>,
  rows: unknown[],
): ImportPreviewResult<T> {
  const valid: ImportRowPreview<T>[] = [];
  const invalid: Extract<ImportRowPreview<T>, { ok: false }>[] = [];
  const seeds = new Map<number, number[]>();

  rows.forEach((raw, index) => {
    const result = schema.safeParse(raw);
    if (!result.success) {
      invalid.push({
        ok: false,
        rowIndex: index,
        errors: result.error.issues.map(
          (issue) => `${issue.path.join(".") || "row"}: ${issue.message}`,
        ),
        raw,
      });
      return;
    }
    const data = result.data as T & { seed?: number };
    if (typeof data.seed === "number") {
      const list = seeds.get(data.seed) ?? [];
      list.push(index);
      seeds.set(data.seed, list);
    }
    valid.push({ ok: true, rowIndex: index, data: result.data });
  });

  const duplicateSeeds = [...seeds.entries()]
    .filter(([, indexes]) => indexes.length > 1)
    .map(([seed]) => seed);

  return {
    valid: valid as ImportPreviewResult<T>["valid"],
    invalid,
    summary: {
      total: rows.length,
      validCount: valid.length,
      invalidCount: invalid.length,
      duplicateSeeds,
    },
  };
}

export function previewSinglesImport(
  rows: unknown[],
): ImportPreviewResult<SinglesImportRow> {
  return previewRows(singlesImportRowSchema, rows);
}

export function previewDoublesImport(
  rows: unknown[],
): ImportPreviewResult<DoublesImportRow> {
  return previewRows(doublesImportRowSchema, rows);
}

export function parseImportRows(
  eventType: "SINGLES" | "DOUBLES",
  rows: unknown[],
): ImportPreviewResult<SinglesImportRow | DoublesImportRow> {
  if (eventType === "SINGLES") {
    return previewSinglesImport(rows);
  }
  return previewDoublesImport(rows);
}
