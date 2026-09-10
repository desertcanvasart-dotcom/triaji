import type { SupabaseClient } from '@supabase/supabase-js';
import { BookingPolicy, DEFAULT_BOOKING_POLICY } from './slots';

/**
 * Load a doctor's booking policy, falling back to schema defaults when no row
 * exists or the table isn't present yet (migration 075 not applied).
 */
export async function loadBookingPolicy(
  supabase: SupabaseClient,
  doctorId: string
): Promise<BookingPolicy> {
  const { data, error } = await supabase
    .from('doctor_booking_policy')
    .select('min_notice_minutes, max_advance_days, default_duration_min, buffer_minutes')
    .eq('doctor_id', doctorId)
    .maybeSingle();

  if (error || !data) return { ...DEFAULT_BOOKING_POLICY };

  return {
    min_notice_minutes: data.min_notice_minutes ?? DEFAULT_BOOKING_POLICY.min_notice_minutes,
    max_advance_days: data.max_advance_days ?? DEFAULT_BOOKING_POLICY.max_advance_days,
    default_duration_min: data.default_duration_min ?? DEFAULT_BOOKING_POLICY.default_duration_min,
    buffer_minutes: data.buffer_minutes ?? DEFAULT_BOOKING_POLICY.buffer_minutes,
  };
}

/** Resolve the duration for a slot: explicit visit type → its duration, else policy default. */
export async function resolveDuration(
  supabase: SupabaseClient,
  doctorId: string,
  visitTypeId: string | null | undefined,
  policyDefault: number
): Promise<number> {
  if (!visitTypeId) return policyDefault;
  const { data } = await supabase
    .from('doctor_visit_types')
    .select('duration_minutes')
    .eq('id', visitTypeId)
    .eq('doctor_id', doctorId)
    .maybeSingle();
  return (data?.duration_minutes as number | undefined) ?? policyDefault;
}
