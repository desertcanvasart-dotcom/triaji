/**
 * ICU Transfer Request API
 *
 * POST /api/icu/transfer — create a new transfer request
 * Auth: verified doctor account required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { TransferStatus } from '@triaji/shared/types/icu';
import { sendTransferRequestNotification } from '@/lib/icu/notifications';

export const dynamic = 'force-dynamic';

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return request.cookies.get('sb-access-token')?.value || null;
}

/** Haversine distance in km between two lat/lng points */
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface TransferRequestBody {
  icu_unit_id: string;
  patient_name_ar: string;
  patient_age?: number;
  patient_sex?: string;
  patient_phone?: string;
  diagnosis_ar: string;
  clinical_summary_ar: string;
  urgency: 'urgent' | 'emergency';
  current_location_ar: string;
  current_location_lat?: number;
  current_location_lng?: number;
}

export async function POST(request: NextRequest) {
  try {
    // ── Auth: verify doctor ──────────────────────────────────────────────
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { data: doctorAccount, error: doctorError } = await supabase
      .from('doctor_accounts')
      .select('id, doctor_id, full_name_ar, full_name_en, tenant_id')
      .eq('user_id', userData.user.id)
      .single();

    if (doctorError || !doctorAccount) {
      return NextResponse.json({ error: 'Doctor account required' }, { status: 403 });
    }

    // ── Parse body ───────────────────────────────────────────────────────
    const body = (await request.json()) as TransferRequestBody;

    if (!body.icu_unit_id || !body.patient_name_ar || !body.diagnosis_ar || !body.clinical_summary_ar || !body.urgency || !body.current_location_ar) {
      return NextResponse.json(
        { error: 'Missing required fields: icu_unit_id, patient_name_ar, diagnosis_ar, clinical_summary_ar, urgency, current_location_ar' },
        { status: 400 }
      );
    }

    if (!['urgent', 'emergency'].includes(body.urgency)) {
      return NextResponse.json({ error: 'urgency must be "urgent" or "emergency"' }, { status: 400 });
    }

    // ── Fetch ICU unit + tenant details ──────────────────────────────────
    const { data: icuUnit, error: unitError } = await supabase
      .from('icu_units')
      .select('id, tenant_id, accepts_transfers, available_beds')
      .eq('id', body.icu_unit_id)
      .eq('is_active', true)
      .single();

    if (unitError || !icuUnit) {
      return NextResponse.json({ error: 'ICU unit not found' }, { status: 404 });
    }

    if (!icuUnit.accepts_transfers) {
      return NextResponse.json({ error: 'This unit does not accept transfers' }, { status: 400 });
    }

    if (icuUnit.available_beds <= 0) {
      return NextResponse.json({ error: 'No beds available in this unit' }, { status: 400 });
    }

    // ── Calculate ETA ────────────────────────────────────────────────────
    let estimatedEtaMinutes: number | null = null;

    if (body.current_location_lat && body.current_location_lng) {
      // Get hospital location from tenants table
      const { data: tenant } = await supabase
        .from('tenants')
        .select('lat, lng')
        .eq('id', icuUnit.tenant_id)
        .single();

      if (tenant?.lat && tenant?.lng) {
        const distanceKm = haversineKm(
          body.current_location_lat,
          body.current_location_lng,
          tenant.lat,
          tenant.lng
        );
        // 40 km/h average Cairo traffic speed
        estimatedEtaMinutes = Math.round((distanceKm / 40) * 60);
        if (estimatedEtaMinutes < 5) estimatedEtaMinutes = 5; // minimum 5 min
      }
    }

    // ── Create transfer request ──────────────────────────────────────────
    const status: TransferStatus = 'requested';

    const { data: transferRequest, error: insertError } = await supabase
      .from('icu_transfer_requests')
      .insert({
        requesting_doctor_id: doctorAccount.doctor_id,
        requesting_account_id: doctorAccount.id,
        requesting_tenant_id: doctorAccount.tenant_id || null,
        receiving_tenant_id: icuUnit.tenant_id,
        icu_unit_id: body.icu_unit_id,
        patient_name_ar: body.patient_name_ar,
        patient_age: body.patient_age || null,
        patient_sex: body.patient_sex || null,
        patient_phone: body.patient_phone || null,
        diagnosis_ar: body.diagnosis_ar,
        clinical_summary_ar: body.clinical_summary_ar,
        urgency: body.urgency,
        current_location_ar: body.current_location_ar,
        current_location_lat: body.current_location_lat || null,
        current_location_lng: body.current_location_lng || null,
        estimated_eta_minutes: estimatedEtaMinutes,
        status,
        requested_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError || !transferRequest) {
      console.error('[ICU Transfer] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to create transfer request' }, { status: 500 });
    }

    // ── Send WhatsApp notification to receiving hospital ─────────────────
    try {
      // Get ICU coordinator phone from tenant
      const { data: receivingTenant } = await supabase
        .from('tenants')
        .select('icu_coordinator_phone, preferred_lang, name_ar, name_en')
        .eq('id', icuUnit.tenant_id)
        .single();

      if (receivingTenant?.icu_coordinator_phone) {
        const lang = receivingTenant.preferred_lang === 'en' ? 'en' : 'ar';
        await sendTransferRequestNotification(
          receivingTenant.icu_coordinator_phone,
          lang,
          {
            doctorName: lang === 'ar'
              ? (doctorAccount.full_name_ar || doctorAccount.full_name_en)
              : (doctorAccount.full_name_en || doctorAccount.full_name_ar),
            patientName: body.patient_name_ar,
            patientAge: body.patient_age || undefined,
            diagnosis: body.diagnosis_ar,
            summary: body.clinical_summary_ar,
            urgency: body.urgency,
            currentLocation: body.current_location_ar,
            etaMinutes: estimatedEtaMinutes || undefined,
          }
        );
      }
    } catch (whatsappErr) {
      // Non-blocking — log but don't fail the request
      console.error('[ICU Transfer] WhatsApp notification failed:', whatsappErr);
    }

    return NextResponse.json(
      { id: transferRequest.id, status: 'requested', estimated_eta_minutes: estimatedEtaMinutes },
      { status: 201 }
    );
  } catch (err) {
    console.error('[ICU Transfer] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
