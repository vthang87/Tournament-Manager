import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { addMinutes, parseISO } from "date-fns";

/** Format a UTC ISO timestamp in the tournament timezone. */
export function formatTournamentTime(
  utcIso: string,
  timeZone: string,
  pattern = "HH:mm",
): string {
  return formatInTimeZone(parseISO(utcIso), timeZone, pattern);
}

export function formatTournamentDateTime(
  utcIso: string,
  timeZone: string,
): string {
  return formatInTimeZone(parseISO(utcIso), timeZone, "yyyy-MM-dd HH:mm");
}

/**
 * Convert a datetime-local value (wall clock in tournament TZ) to UTC ISO.
 */
export function zonedLocalToUtcIso(
  localDateTime: string,
  timeZone: string,
): string {
  // datetime-local: "YYYY-MM-DDTHH:mm"
  return fromZonedTime(localDateTime, timeZone).toISOString();
}

/** Convert UTC ISO to datetime-local string in tournament TZ. */
export function utcIsoToZonedLocal(utcIso: string, timeZone: string): string {
  return formatInTimeZone(parseISO(utcIso), timeZone, "yyyy-MM-dd'T'HH:mm");
}

export function addMinutesUtc(utcIso: string, minutes: number): string {
  return addMinutes(parseISO(utcIso), minutes).toISOString();
}

/** Build time column slots for the timeline grid. */
export function buildTimeSlots(
  startUtcIso: string,
  endUtcIso: string,
  slotMinutes: number,
): string[] {
  const slots: string[] = [];
  let cursor = parseISO(startUtcIso).getTime();
  const end = parseISO(endUtcIso).getTime();
  const step = slotMinutes * 60_000;
  while (cursor < end) {
    slots.push(new Date(cursor).toISOString());
    cursor += step;
  }
  return slots;
}
