/**
 * Slot-time helpers for the doctor availability manager.
 *
 * Slot times are stored as a *floating* clinic-local wall clock: the digits the
 * user enters ("12:00") are saved verbatim with a trailing `Z`, and always
 * displayed back in UTC so the same digits round-trip for every viewer,
 * regardless of their browser timezone. This matches how the rest of the
 * platform reads `slot_datetime` (servers run in UTC and format the naive value
 * directly). Appointments in a single-timezone clinic are wall-clock
 * commitments, so they intentionally do not shift with DST.
 *
 * Building and formatting both go through here so single-add, the weekly-
 * schedule generator, and the calendar display can never drift apart again.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

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

/** True when the half-open intervals [aStart, aEnd) and [bStart, bEnd) overlap. */
export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * True when [aStart, aStart+aDur) and [bStart, bStart+bDur) overlap.
 * Start values are epoch milliseconds; durations are minutes.
 */
export function slotsOverlap(
  aStart: number,
  aDurMin: number,
  bStart: number,
  bDurMin: number
): boolean {
  return intervalsOverlap(aStart, aStart + aDurMin * 60_000, bStart, bStart + bDurMin * 60_000);
}

/** Start of a clinic-local calendar day as a floating `Z` timestamp. */
export function dayStart(dateStr: string): string | null {
  return buildSlotDatetime(dateStr, '00:00');
}

/** Start of the day AFTER `dateStr` (exclusive end of a full day). */
export function nextDayStart(dateStr: string): string | null {
  const start = dayStart(dateStr);
  if (!start) return null;
  return new Date(new Date(start).getTime() + 86_400_000).toISOString();
}

/**
 * Buffer-aware conflict: two slots conflict when they overlap OR sit closer than
 * `bufferMin` apart. With bufferMin = 0 this is a plain overlap.
 */
export function slotsConflict(
  aStart: number,
  aDurMin: number,
  bStart: number,
  bDurMin: number,
  bufferMin = 0
): boolean {
  const buffer = bufferMin * 60_000;
  const aEnd = aStart + aDurMin * 60_000;
  const bEnd = bStart + bDurMin * 60_000;
  return aStart < bEnd + buffer && bStart < aEnd + buffer;
}

export const DEFAULT_SLOT_DURATION_MIN = 30;

/** Per-doctor booking policy with the schema defaults applied. */
export interface BookingPolicy {
  min_notice_minutes: number;
  max_advance_days: number;
  default_duration_min: number;
  buffer_minutes: number;
}

export const DEFAULT_BOOKING_POLICY: BookingPolicy = {
  min_notice_minutes: 0,
  max_advance_days: 60,
  default_duration_min: DEFAULT_SLOT_DURATION_MIN,
  buffer_minutes: 0,
};

/** Widen a query window so any reasonable-duration neighbour is fetched. */
export const CONFLICT_WINDOW_MS = 4 * 60 * 60_000;
