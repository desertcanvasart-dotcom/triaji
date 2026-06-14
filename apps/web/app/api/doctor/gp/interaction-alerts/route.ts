/**
 * GET /api/doctor/gp/interaction-alerts
 * GP Drug Interaction Alerts — Doctor-only dashboard widget feed.
 *
 * Lists this GP's patients whose current medications have known interactions.
 * For every active GP relationship, loads the patient's current medications
 * (patient_medications via patient_profiles) and runs the same interaction
 * checker the doctor /api/interactions/check uses, emitting one alert per
 * interacting drug pair.
 *
 * Returns: { alerts: GpPatientInteraction[] }
 *   GpPatientInteraction = {
 *     patientId, patientNameAr, patientNameEn, patientPhone,
 *     drugA, drugB, severity
 *   }
 *
 * Auth: Verified doctor session required (sb-access-token cookie or Bearer).
 * 401 if not a verified doctor. 404 if the doctor has no active GP relationships
 * (the widget hides itself on 404).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@triaji/shared/supabase';
import { checkDrugInteractions } from '@/lib/interactions/checker';
import type { DrugInput, InteractionSeverity } from '@triaji/shared/types';

export const dynamic = 'force-dynamic';

// ─── Response shape ───────────────────────────────────────────────────────────

interface GpPatientInteraction {
  patientId: string;
  patientNameAr: string;
  patientNameEn: string | null;
  patientPhone: string;
  drugA: string;
  drugB: string;
  severity: InteractionSeverity;
}

// ─── Auth (mirrors /api/interactions/check) ──────────────────────────────────

interface DoctorAccount {
  id: string;
  user_id: string;
  doctor_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
}

function getAnonClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
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

  const supabase = createServerClient();
  const { data: doctorAccount } = await supabase
    .from('doctor_accounts')
    .select('id, user_id, doctor_id, verification_status')
    .eq('user_id', user.id)
    .single();

  if (!doctorAccount || doctorAccount.verification_status !== 'verified') return null;
  return doctorAccount as DoctorAccount;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface PatientRow {
  id: string;
  name_ar: string | null;
  phone_number: string | null;
}

function asPatient(rel: Record<string, unknown>): PatientRow | null {
  const raw = rel['patients'];
  const pat = Array.isArray(raw) ? raw[0] : raw;
  if (!pat || typeof pat !== 'object') return null;
  return pat as PatientRow;
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate doctor
    const doctorAccount = await authenticateDoctor(request);
    if (!doctorAccount) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول كطبيب' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();

    // 2. Find this doctor's active GP patients. A relationship belongs to this
    //    doctor by either doctor_account_id or doctor_id (both reference them).
    const { data: relationships, error: relError } = await supabase
      .from('gp_relationships')
      .select(`
        patient_id,
        status,
        patients!inner ( id, name_ar, phone_number )
      `)
      .eq('status', 'active')
      .or(`doctor_account_id.eq.${doctorAccount.id},doctor_id.eq.${doctorAccount.doctor_id}`);

    if (relError) {
      console.error('[gp/interaction-alerts] Relationship query failed:', relError.message);
      return NextResponse.json({ error: 'فشل تحميل قائمة المرضى' }, { status: 500 });
    }

    // No GP relationships → 404 so the widget hides itself.
    if (!relationships || relationships.length === 0) {
      return NextResponse.json({ error: 'لا توجد علاقات رعاية أولية' }, { status: 404 });
    }

    // 3. Map patient_id → patient info, deduping (a patient appears once).
    const patientsById = new Map<string, PatientRow>();
    for (const rel of relationships as Record<string, unknown>[]) {
      const patientId = rel['patient_id'] as string | undefined;
      const pat = asPatient(rel);
      if (patientId && pat) patientsById.set(patientId, pat);
    }

    const patientIds = [...patientsById.keys()];
    if (patientIds.length === 0) {
      return NextResponse.json({ alerts: [] });
    }

    // 4. Resolve patient_profiles for these patients (medications hang off the
    //    profile, not the patient directly).
    const { data: profiles } = await supabase
      .from('patient_profiles')
      .select('id, patient_id')
      .in('patient_id', patientIds);

    const patientIdByProfileId = new Map<string, string>();
    const profileIds: string[] = [];
    for (const p of (profiles ?? []) as Record<string, unknown>[]) {
      const profileId = p['id'] as string | undefined;
      const patientId = p['patient_id'] as string | undefined;
      if (profileId && patientId) {
        patientIdByProfileId.set(profileId, patientId);
        profileIds.push(profileId);
      }
    }

    if (profileIds.length === 0) {
      return NextResponse.json({ alerts: [] });
    }

    // 5. Load current medications for all profiles in one query, group per patient.
    const { data: meds } = await supabase
      .from('patient_medications')
      .select('patient_profile_id, drug_name_ar, drug_name_en')
      .in('patient_profile_id', profileIds);

    const drugsByPatient = new Map<string, DrugInput[]>();
    for (const m of (meds ?? []) as Record<string, unknown>[]) {
      const profileId = m['patient_profile_id'] as string | undefined;
      const patientId = profileId ? patientIdByProfileId.get(profileId) : undefined;
      if (!patientId) continue;

      const nameAr = (m['drug_name_ar'] as string | null) ?? '';
      const nameEn = (m['drug_name_en'] as string | null) ?? null;
      if (!nameAr && !nameEn) continue;

      const list = drugsByPatient.get(patientId) ?? [];
      list.push({ nameAr: nameAr || (nameEn ?? ''), nameEn });
      drugsByPatient.set(patientId, list);
    }

    // 6. Run the interaction checker per patient. checkDrugInteractions compares
    //    one "new" drug against a list of "existing" drugs, so to get every
    //    unordered pair we check drug[i] against drug[i+1..]. Reuses the exact
    //    logic behind /api/interactions/check (local table → OpenFDA fallback).
    const alerts: GpPatientInteraction[] = [];

    for (const [patientId, drugs] of drugsByPatient) {
      if (drugs.length < 2) continue;

      const pat = patientsById.get(patientId);
      if (!pat) continue;

      const seenPairs = new Set<string>();

      for (let i = 0; i < drugs.length; i++) {
        const newDrug = drugs[i];
        if (!newDrug) continue;
        const rest = drugs.slice(i + 1);
        if (rest.length === 0) continue;

        const result = await checkDrugInteractions(newDrug, rest);

        for (const interaction of result.interactions) {
          // Dedupe symmetric pairs (drugA+drugB == drugB+drugA).
          const key = [interaction.drugA.toLowerCase(), interaction.drugB.toLowerCase()]
            .sort()
            .join('|');
          if (seenPairs.has(key)) continue;
          seenPairs.add(key);

          alerts.push({
            patientId,
            patientNameAr: pat.name_ar ?? '',
            patientNameEn: null,
            patientPhone: pat.phone_number ?? '',
            drugA: interaction.drugA,
            drugB: interaction.drugB,
            severity: interaction.severity,
          });
        }
      }
    }

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('[gp/interaction-alerts] Failed:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تحميل تنبيهات التفاعلات الدوائية' },
      { status: 500 }
    );
  }
}
