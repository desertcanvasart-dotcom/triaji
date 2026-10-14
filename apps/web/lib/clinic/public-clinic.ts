/**
 * Helpers for a clinic's public booking page (/{locale}/clinic/[clinicSlug]).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** The clinic's booking mode allows patients to pick a slot online. */
export function allowsSlotBooking(mode: string | null | undefined): boolean {
  return mode === 'slots_only' || mode === 'both';
}

/**
 * Whether `doctorId` practises at the clinic `tenantId` — primary affiliation
 * (doctors.tenant_id) or a doctor_tenants secondary (migration 065), mirroring
 * how the clinic page lists its doctors.
 */
export async function doctorBelongsToClinic(
  supabase: SupabaseClient,
  tenantId: string,
  doctorId: string
): Promise<boolean> {
  const { data: doctor } = await supabase
    .from('doctors')
    .select('tenant_id, is_active')
    .eq('id', doctorId)
    .maybeSingle();
  if (!doctor || doctor.is_active === false) return false;
  if (doctor.tenant_id === tenantId) return true;

  const { data: link } = await supabase
    .from('doctor_tenants')
    .select('doctor_id')
    .eq('doctor_id', doctorId)
    .eq('tenant_id', tenantId)
    .limit(1)
    .maybeSingle();
  return !!link;
}

/** An active clinic and its booking mode, or null. */
export async function loadClinic(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ id: string; bookingMode: string } | null> {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .eq('tier', 'clinic')
    .eq('is_active', true)
    .maybeSingle();
  if (!tenant) return null;

  const { data: config } = await supabase
    .from('tenant_config')
    .select('clinic_booking_mode')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return {
    id: tenant.id as string,
    bookingMode: (config?.clinic_booking_mode as string | null) ?? 'walk_in_only',
  };
}
