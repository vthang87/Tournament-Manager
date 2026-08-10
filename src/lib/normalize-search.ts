/** Accent-insensitive, case-insensitive search text (e.g. "viet" ↔ "Việt"). */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    // Vietnamese Đ/đ does not decompose via NFD — map explicitly.
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
}

/** True when haystack contains needle after accent/case folding. */
export function matchesSearch(haystack: string, needle: string): boolean {
  const q = normalizeSearch(needle);
  if (!q) return true;
  return normalizeSearch(haystack).includes(q);
}
