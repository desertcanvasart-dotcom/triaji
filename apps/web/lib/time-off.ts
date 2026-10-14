/**
 * Doctor time off (migration 074) — shared checks for the web app.
 *
 * doctor_time_off is an overlay of blocked intervals: a day off hides the
 * doctor's open slots inside it from patients and refuses new bookings and new
 * slots there, without deleting anything — removing the block brings the slots
 * back. Intervals use the same floating clinic-local convention as
 * doctor_availability.slot_datetime (see lib/slots.ts): a full day off for D is
 * [D 00:00Z, D+1 00:00Z).
 *
 * Every helper degrades to "no blocks" on a database without migration 074.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_SLOT_DURATION_MIN } from '@/lib/slots';

export interface TimeOffBlock {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

export function isMissingTimeOffTable(error: { code?: string; message?: string } | null): boolean {
  return (
    error?.code === '42P01' ||
    /relation .*doctor_time_off.* does not exist/i.test(error?.message ?? '')
  );
}

/** Blocks for a doctor that overlap [fromIso, toIso). */
export async function fetchTimeOff(
  supabase: SupabaseClient,
  doctorId: string,
  fromIso: string,
  toIso: string
): Promise<TimeOffBlock[]> {
  const { data, error } = await supabase
    .from('doctor_time_off')
    .select('id, starts_at, ends_at, reason')
    .eq('doctor_id', doctorId)
    .lt('starts_at', toIso)
    .gt('ends_at', fromIso)
    .order('starts_at', { ascending: true });

  if (error) {
    if (!isMissingTimeOffTable(error)) {
      console.error('[time-off] fetch failed:', error.message);
    }
    return [];
  }
  return (data ?? []) as TimeOffBlock[];
}

/** True when a slot starting at `slotIso` overlaps any block. */
export function isSlotBlocked(
  slotIso: string,
  durationMinutes: number | null | undefined,
  blocks: TimeOffBlock[]
): boolean {
  const start = new Date(slotIso).getTime();
  const end = start + (durationMinutes ?? DEFAULT_SLOT_DURATION_MIN) * 60_000;
  return blocks.some((b) => {
    const bStart = new Date(b.starts_at).getTime();
    const bEnd = new Date(b.ends_at).getTime();
    return start < bEnd && bStart < end;
  });
}

/** True when the given availability slot falls inside the doctor's time off. */
export async function slotIdIsBlocked(supabase: SupabaseClient, slotId: string): Promise<boolean> {
  const { data: slot } = await supabase
    .from('doctor_availability')
    .select('doctor_id, slot_datetime, duration_minutes')
    .eq('id', slotId)
    .maybeSingle();
  if (!slot) return false;

  const start = new Date(slot.slot_datetime as string).getTime();
  const end = start + ((slot.duration_minutes as number | null) ?? DEFAULT_SLOT_DURATION_MIN) * 60_000;
  const blocks = await fetchTimeOff(
    supabase,
    slot.doctor_id as string,
    new Date(start).toISOString(),
    new Date(end).toISOString()
  );
  return isSlotBlocked(slot.slot_datetime as string, slot.duration_minutes as number | null, blocks);
}
