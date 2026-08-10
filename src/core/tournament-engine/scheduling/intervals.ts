import type { TimeInterval } from "./types";

/** True when intervals share any overlapping instant (half-open [start, end)). */
export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

/** Gap in minutes from the end of `earlier` to the start of `later`. Negative if overlapping. */
export function gapMinutes(earlier: TimeInterval, later: TimeInterval): number {
  return (later.startMs - earlier.endMs) / 60_000;
}

export function parseInterval(
  startTime: string,
  endTime: string,
): TimeInterval {
  const startMs = Date.parse(startTime);
  const endMs = Date.parse(endTime);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new Error(`Invalid time interval: ${startTime} – ${endTime}`);
  }
  if (endMs <= startMs) {
    throw new Error(`endTime must be after startTime: ${startTime} – ${endTime}`);
  }
  return { startMs, endMs };
}

export function addMinutesIso(startTime: string, minutes: number): string {
  const startMs = Date.parse(startTime);
  return new Date(startMs + minutes * 60_000).toISOString();
}
