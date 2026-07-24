/**
 * Status label key helpers for next-intl.
 *
 * Pages and components should use the `status` namespace:
 *
 * ```tsx
 * const tStatus = useTranslations("status");
 * tStatus(tournamentStatusKey("DRAFT")); // "Nháp" / "Draft"
 * tStatus(eventStatusKey("DRAW_READY")); // "Sẵn sàng bốc thăm" / ...
 * ```
 *
 * Keys mirror `messages/{locale}.json` → `status.<category>.<CODE>`.
 */

export type StatusCategory =
  | "tournament"
  | "event"
  | "match"
  | "stage"
  | "entry"
  | "drawSession";

/** Returns a dot-path key for use with `useTranslations("status")`. */
export function statusKey(
  category: StatusCategory,
  status: string,
): `${StatusCategory}.${string}` {
  return `${category}.${status}`;
}

export function tournamentStatusKey(status: string) {
  return statusKey("tournament", status);
}

export function eventStatusKey(status: string) {
  return statusKey("event", status);
}

export function matchStatusKey(status: string) {
  return statusKey("match", status);
}

export function stageStatusKey(status: string) {
  return statusKey("stage", status);
}

export function entryStatusKey(status: string) {
  return statusKey("entry", status);
}

export function drawSessionStatusKey(status: string) {
  return statusKey("drawSession", status);
}
