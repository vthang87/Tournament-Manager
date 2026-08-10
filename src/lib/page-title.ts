import type { Metadata } from "next";

/**
 * Document title segments. Root layout appends " · AppName" via title.template.
 * Pass the most specific segment first (e.g. page action, entity, parent).
 */
export function pageTitle(
  ...segments: Array<string | null | undefined>
): Metadata {
  const parts = segments
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
  return { title: parts.length > 0 ? parts.join(" · ") : undefined };
}
