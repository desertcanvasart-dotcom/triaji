/**
 * Doctor Matcher
 * Matches patients to nearby doctors using PostGIS RPCs.
 * Three strategies in order: geo → governorate → specialty-only fallback.
 */

import { createServerClient } from '@triaji/shared/supabase';
import type { MatchedDoctor } from '@triaji/shared/types';

export interface DoctorMatchInput {
  specialtyId: string;
  patientLat: number | null;
  patientLng: number | null;
  governorateId: string | null;
  tenantId: string | null;
  radiusKm?: number;
}

interface RpcDoctorRow {
  id: string;
  name_ar: string;
  title_ar: string | null;
  specialty_id: string;
  specialty_name_ar: string;
  governorate_name_ar: string;
  clinic_address_ar: string | null;
  consultation_fee_egp: number | null;
  rating_avg: number | null;
  rating_count: number | null;
  languages: string[] | null;
  photo_url: string | null;
  distance_km: number | null;
}

function mapDoctor(d: RpcDoctorRow): MatchedDoctor {
  return {
    id: d.id,
    nameAr: d.name_ar,
    titleAr: d.title_ar ?? 'دكتور',
    specialtyId: d.specialty_id,
    specialtyNameAr: d.specialty_name_ar,
    governorateNameAr: d.governorate_name_ar,
    clinicAddressAr: d.clinic_address_ar,
    consultationFeeEgp: d.consultation_fee_egp,
    ratingAvg: d.rating_avg ?? 0,
    ratingCount: d.rating_count ?? 0,
    languages: d.languages ?? ['ar'],
    photoUrl: d.photo_url,
    distanceKm: d.distance_km ?? 0,
  };
}

/**
 * Match doctors to a patient based on specialty and location.
 * Strategy 1: PostGIS proximity search (if lat/lng available)
 * Strategy 2: Governorate fallback (if governorate known)
 * Strategy 3: Any doctor with that specialty in Egypt
 */
export async function matchDoctors(input: DoctorMatchInput): Promise<MatchedDoctor[]> {
  const supabase = createServerClient();

  // Strategy 1: precise geo-match if lat/lng available
  if (input.patientLat !== null && input.patientLng !== null) {
    const { data, error } = await supabase.rpc('find_doctors_near', {
      p_specialty_id: input.specialtyId,
      p_patient_lat: input.patientLat,
      p_patient_lng: input.patientLng,
      p_radius_km: input.radiusKm ?? 100,
      p_tenant_id: input.tenantId,
      p_limit: 5,
    });

    if (!error && data && (data as RpcDoctorRow[]).length > 0) {
      return (data as RpcDoctorRow[]).map(mapDoctor);
    }

    // Expand radius to 200km if no results within initial radius
    if (!error && (!data || (data as RpcDoctorRow[]).length === 0)) {
      const { data: wider } = await supabase.rpc('find_doctors_near', {
        p_specialty_id: input.specialtyId,
        p_patient_lat: input.patientLat,
        p_patient_lng: input.patientLng,
        p_radius_km: 200,
        p_tenant_id: input.tenantId,
        p_limit: 5,
      });
      if (wider && (wider as RpcDoctorRow[]).length > 0) {
        return (wider as RpcDoctorRow[]).map(mapDoctor);
      }
    }
  }

  // Strategy 2: governorate fallback if no precise location
  if (input.governorateId) {
    const { data } = await supabase.rpc('find_doctors_by_governorate', {
      p_specialty_id: input.specialtyId,
      p_governorate_id: input.governorateId,
      p_tenant_id: input.tenantId,
      p_limit: 5,
    });
    if (data && (data as RpcDoctorRow[]).length > 0) {
      return (data as RpcDoctorRow[]).map(mapDoctor);
    }
  }

  // Strategy 3: specialty-only fallback (any doctor in Egypt for this specialty)
  const { data: fallback } = await supabase
    .from('doctors')
    .select('id, name_ar, title_ar, specialty_id, clinic_address_ar, consultation_fee_egp, rating_avg, rating_count, languages, photo_url, governorate_id')
    .eq('specialty_id', input.specialtyId)
    .eq('is_active', true)
    .eq('accepting_new_patients', true)
    .order('rating_avg', { ascending: false })
    .limit(5);

  if (fallback && fallback.length > 0) {
    // Need to fetch specialty and governorate names separately
    const specialtyIds = [...new Set(fallback.map((d) => d.specialty_id as string))];
    const govIds = [...new Set(fallback.map((d) => d.governorate_id as string))];

    const [{ data: specs }, { data: govs }] = await Promise.all([
      supabase.from('specialties').select('id, name_ar').in('id', specialtyIds),
      supabase.from('governorates').select('id, name_ar').in('id', govIds),
    ]);

    const specMap = new Map((specs ?? []).map((s) => [s.id as string, s.name_ar as string]));
    const govMap = new Map((govs ?? []).map((g) => [g.id as string, g.name_ar as string]));

    return fallback.map((d) => ({
      id: d.id as string,
      nameAr: d.name_ar as string,
      titleAr: (d.title_ar as string | null) ?? 'دكتور',
      specialtyId: d.specialty_id as string,
      specialtyNameAr: specMap.get(d.specialty_id as string) ?? '',
      governorateNameAr: govMap.get(d.governorate_id as string) ?? '',
      clinicAddressAr: d.clinic_address_ar as string | null,
      consultationFeeEgp: d.consultation_fee_egp as number | null,
      ratingAvg: (d.rating_avg as number | null) ?? 0,
      ratingCount: (d.rating_count as number | null) ?? 0,
      languages: (d.languages as string[] | null) ?? ['ar'],
      photoUrl: d.photo_url as string | null,
      distanceKm: 0,
    }));
  }

  return [];
}
