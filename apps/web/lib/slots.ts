/**
 * Slot-time helpers for the doctor availability manager (web/doctor portal).
 *
 * Mirrors apps/admin/lib/slots.ts: slot_datetime is a *floating* clinic-local
 * wall clock stored with a trailing `Z` and always displayed in UTC, so the
 * digits a doctor enters round-trip identically for every viewer. Keep this in
 * sync with the admin copy — see the "slot-datetime-floating-local" convention.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DEFAULT_SLOT_DURATION_MIN = 30;

/** Widen a conflict query so any reasonable-duration neighbour is fetched. */
export const CONFLICT_WINDOW_MS = 4 * 60 * 60_000;

/** Combine a calendar date (YYYY-MM-DD) and wall-clock time (HH:MM). */
export function buildSlotDatetime(dateStr: string, timeStr: string): string | null {
  if (!DATE_RE.test(dateStr) || !TIME_RE.test(timeStr)) return null;
  return `${dateStr}T${timeStr}:00.000Z`;
}

/** Render a stored slot timestamp back to its clinic wall-clock time. */
export function formatSlotClock(iso: string, locale = 'en-US'): string {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
}

/** True when [aStart, aStart+aDur) and [bStart, bStart+bDur) overlap (ms + minutes). */
export function slotsOverlap(aStart: number, aDurMin: number, bStart: number, bDurMin: number): boolean {
  return aStart < bStart + bDurMin * 60_000 && bStart < aStart + aDurMin * 60_000;
}
