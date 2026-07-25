/** Display "CODE · Name", or whichever is available. */
export function formatClubLabel(
  clubCode: string | null | undefined,
  clubName: string | null | undefined,
): string | null {
  const code = clubCode?.trim() || null;
  const name = clubName?.trim() || null;
  if (code && name && code !== name) return `${code} · ${name}`;
  return code ?? name;
}
