/**
 * POST /api/interactions/check
 * Drug Interaction Check API — Doctor-only endpoint.
 *
 * Body: InteractionCheckRequest { newDrug, existingDrugs, patientId, doctorAccountId, healthRecordId? }
 * Returns: CheckResult
 *
 * Auth: Doctor session required. Patient sessions receive 403.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkDrugInteractions } from '@/lib/interactions/checker';
import type { InteractionCheckRequest } from '@triaji/shared/types';

export const dynamic = 'force-dynamic';

// ─── Supabase Clients ───────────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function getAnonClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ─── Auth ───────────────────────────────────────────────────────────────────

interface DoctorAccount {
  id: string;
  doctor_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
}

async function authenticateDoctor(request: NextRequest): Promise<DoctorAccount | null> {
  const accessToken =
    request.cookies.get('sb-access-token')?.value ??
    request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!accessToken) return null;

  const anonClient = getAnonClient();
  const {
    data: { user },
    error,
  } = await anonClient.auth.getUser(accessToken);
  if (error || !user) return null;

  const supabase = getServiceClient();
  const { data: doctorAccount } = await supabase
    .from('doctor_accounts')
    .select('id, doctor_id, verification_status')
    .eq('id', user.id)
    .single();

  if (!doctorAccount || doctorAccount.verification_status !== 'verified') return null;
  return doctorAccount as DoctorAccount;
}

// ─── POST Handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate doctor
    const doctorAccount = await authenticateDoctor(request);
    if (!doctorAccount) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول كطبيب' },
        { status: 401 }
      );
    }

    // 2. Parse body
    const body: InteractionCheckRequest = await request.json();
    const { newDrug, existingDrugs, patientId, healthRecordId } = body;

    if (!newDrug || !existingDrugs || !patientId) {
      return NextResponse.json(
        { error: 'بيانات ناقصة: newDrug, existingDrugs, patientId مطلوبين' },
        { status: 400 }
      );
    }

    // 3. Run interaction check
    const result = await checkDrugInteractions(newDrug, existingDrugs);

    // 4. Log to interaction_check_log
    const supabase = getServiceClient();
    await supabase.from('interaction_check_log').insert({
      patient_id: patientId,
      doctor_account_id: doctorAccount.id,
      health_record_id: healthRecordId ?? null,
      new_drug_name_en: newDrug.nameEn ?? newDrug.nameAr,
      checked_against_drugs: existingDrugs.map((d) => d.nameEn ?? d.nameAr),
      interactions_found: result.interactions,
      highest_severity: result.highestSeverity,
      check_source: result.checkSource,
    });

    // 5. Return result
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Interactions] Check failed:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء فحص التفاعلات الدوائية' },
      { status: 500 }
    );
  }
}
