import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';
import type { ChildProfile, GuardianRelation } from '@triaji/shared/types/paediatric';

// ─── GET /api/patient/children ──────────────────────────────────────────────
// Returns all children linked to the authenticated guardian
export async function GET() {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createServerClient();

  const { data: relationships, error } = await supabase
    .from('guardian_relationships')
    .select(`
      relation,
      child_patient_id,
      child:patients!guardian_relationships_child_patient_id_fkey (
        id,
        phone_number
      ),
      child_profile:patient_profiles!guardian_relationships_child_patient_id_fkey (
        id,
        date_of_birth,
        biological_sex,
        is_paediatric
      )
    `)
    .eq('guardian_patient_id', patient.patientId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();
  const children: ChildProfile[] = (relationships ?? [])
    .filter((r: Record<string, unknown>) => r.child_profile)
    .map((r: Record<string, unknown>) => {
      const profile = r.child_profile as Record<string, unknown>;
      const dob = new Date(profile.date_of_birth as string);
      const ageMs = now.getTime() - dob.getTime();
      const ageMonths = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 30.44));

      // Get child name from patients table or profile
      const child = r.child as Record<string, unknown> | null;

      return {
        patientId: r.child_patient_id as string,
        name: (child as Record<string, unknown>)?.display_name as string ?? '',
        dateOfBirth: profile.date_of_birth as string,
        ageMonths,
        sex: profile.biological_sex as 'male' | 'female',
        relation: r.relation as GuardianRelation,
        isPaediatric: true as const,
      };
    });

  return NextResponse.json({ children });
}

// ─── POST /api/patient/children ─────────────────────────────────────────────
// Add a new child profile linked to the authenticated guardian
export async function POST(request: NextRequest) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json();

  // Validate required fields
  const { name, dateOfBirth, sex, relation } = body as {
    name: string;
    dateOfBirth: string;
    sex: 'male' | 'female';
    relation: GuardianRelation;
    bloodType?: string;
    gestationalAgeWeeks?: number;
    birthWeightGrams?: number;
    allergies?: string[];
    chronicConditions?: string[];
    vaccinationOption: 'fully_vaccinated' | 'unknown' | 'enter_later';
  };

  if (!name || !dateOfBirth || !sex || !relation) {
    return NextResponse.json(
      { error: 'name, dateOfBirth, sex, and relation are required' },
      { status: 400 }
    );
  }

  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) {
    return NextResponse.json({ error: 'Invalid dateOfBirth' }, { status: 400 });
  }

  const supabase = createServerClient();

  // 1. Get parent's phone number
  const { data: parentPatient } = await supabase
    .from('patients')
    .select('phone_number')
    .eq('id', patient.patientId)
    .single();

  if (!parentPatient) {
    return NextResponse.json({ error: 'Parent patient not found' }, { status: 404 });
  }

  // 2. Create patients row for child (uses parent's phone)
  const { data: childPatient, error: childError } = await supabase
    .from('patients')
    .insert({
      phone_number: parentPatient.phone_number,
      display_name: name,
      is_child_account: true,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (childError || !childPatient) {
    return NextResponse.json(
      { error: childError?.message ?? 'Failed to create child patient' },
      { status: 500 }
    );
  }

  const childPatientId = childPatient.id;

  // 3. Create patient_profiles with is_paediatric=true
  const { data: childProfile, error: profileError } = await supabase
    .from('patient_profiles')
    .insert({
      patient_id: childPatientId,
      date_of_birth: dateOfBirth,
      biological_sex: sex,
      is_paediatric: true,
      blood_type: body.bloodType ?? null,
      gestational_age_weeks: body.gestationalAgeWeeks ?? null,
      birth_weight_grams: body.birthWeightGrams ?? null,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (profileError || !childProfile) {
    return NextResponse.json(
      { error: profileError?.message ?? 'Failed to create child profile' },
      { status: 500 }
    );
  }

  // 4. Create guardian_relationships
  const { error: relError } = await supabase
    .from('guardian_relationships')
    .insert({
      guardian_patient_id: patient.patientId,
      child_patient_id: childPatientId,
      relation,
      is_primary_guardian: true,
      can_book: true,
      can_view_records: true,
    });

  if (relError) {
    return NextResponse.json({ error: relError.message }, { status: 500 });
  }

  // 5. Insert child allergies if provided
  if (body.allergies?.length > 0) {
    await supabase.from('patient_allergies').insert(
      body.allergies.map((code: string) => ({
        patient_profile_id: childProfile.id,
        allergy_code: code,
      }))
    );
  }

  // 6. Insert chronic conditions if provided
  if (body.chronicConditions?.length > 0) {
    await supabase.from('patient_chronic_conditions').insert(
      body.chronicConditions.map((code: string) => ({
        patient_profile_id: childProfile.id,
        condition_code: code,
      }))
    );
  }

  // 7. Auto-generate vaccination_schedule from vaccine_catalog + date_of_birth
  const { data: catalog } = await supabase
    .from('vaccine_catalog')
    .select('*')
    .order('sort_order', { ascending: true });

  if (catalog && catalog.length > 0) {
    const now = new Date();
    const scheduleEntries: Record<string, unknown>[] = [];

    for (const vaccine of catalog) {
      const scheduledMonths: number[] = vaccine.schedule_months ?? [];

      scheduledMonths.forEach((ageMonth: number, idx: number) => {
        const dueDate = new Date(dob);
        dueDate.setMonth(dueDate.getMonth() + ageMonth);

        const isPastDue = dueDate < now;
        const vaccinationOption = body.vaccinationOption as string;

        let status: string = 'due';
        let givenDate: string | null = null;
        let notesAr: string | null = null;

        // If fully_vaccinated and this dose is past due, mark as given
        if (vaccinationOption === 'fully_vaccinated' && isPastDue) {
          status = 'given';
          givenDate = null; // Date unknown
          notesAr = 'تطعيم مسبق — تاريخ غير محدد';
        } else if (isPastDue && vaccinationOption !== 'enter_later') {
          status = 'overdue';
        }

        scheduleEntries.push({
          patient_id: childPatientId,
          vaccine_code: vaccine.code,
          dose_number: idx + 1,
          scheduled_age_months: ageMonth,
          due_date: dueDate.toISOString().split('T')[0],
          status,
          given_date: givenDate,
          notes_ar: notesAr,
          reminder_sent: false,
        });
      });
    }

    if (scheduleEntries.length > 0) {
      await supabase.from('vaccination_schedule').insert(scheduleEntries);
    }
  }

  return NextResponse.json({
    success: true,
    childPatientId,
    profileId: childProfile.id,
  });
}
