import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

export const dynamic = 'force-dynamic';

// ─── POST /api/patient/medical-record/send-to-pharmacy ─────────────────────────
// The patient taps "أرسل للصيدلية" next to one of their active medications in the
// medical-record dashboard (MedicationAdherenceList). The component posts a single
// `medication_id` (a patient_medications.id). We materialise that medication as a
// prescription health_record and route it to a pharmacy via prescription_routing,
// reusing the same pipeline doctors use (see api/pharmacy/route-prescription +
// migration 038_prescription_routing).
//
// Request:  { medication_id: string, pharmacy_tenant_id?: string }
// Response: 201 { routing: <prescription_routing row>, health_record_id: string }
export async function POST(request: NextRequest) {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'غير مصرّح. يرجى تسجيل الدخول' }, { status: 401 });
  }

  let body: { medication_id?: unknown; pharmacy_tenant_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 });
  }

  const medicationId = typeof body.medication_id === 'string' ? body.medication_id : null;
  if (!medicationId) {
    return NextResponse.json({ error: 'معرّف الدواء مطلوب' }, { status: 400 });
  }
  const requestedPharmacyId =
    typeof body.pharmacy_tenant_id === 'string' ? body.pharmacy_tenant_id : null;

  const supabase = createServerClient();

  // 1. Load the patient (name + phone are NOT NULL on prescription_routing).
  const { data: patientRow, error: patientErr } = await supabase
    .from('patients')
    .select('id, name_ar, phone_number')
    .eq('id', patient.patientId)
    .single();

  if (patientErr || !patientRow) {
    return NextResponse.json({ error: 'لم يتم العثور على المريض' }, { status: 404 });
  }

  // 2. Verify the medication belongs to this patient's profile, scoped via
  //    patient_profiles → patient_medications (never trust the client's id alone).
  const { data: profileRow } = await supabase
    .from('patient_profiles')
    .select('id')
    .eq('patient_id', patient.patientId)
    .single();

  if (!profileRow) {
    return NextResponse.json({ error: 'لم يتم العثور على الملف الطبي' }, { status: 404 });
  }

  const { data: medication, error: medErr } = await supabase
    .from('patient_medications')
    .select('id, drug_name_ar, drug_name_en, dose, frequency_ar, for_condition_ar')
    .eq('id', medicationId)
    .eq('patient_profile_id', (profileRow as { id: string }).id)
    .single();

  if (medErr || !medication) {
    return NextResponse.json({ error: 'لم يتم العثور على هذا الدواء' }, { status: 404 });
  }
  const med = medication as {
    id: string;
    drug_name_ar: string;
    drug_name_en: string | null;
    dose: string | null;
    frequency_ar: string | null;
    for_condition_ar: string | null;
  };

  // 3. Resolve the destination pharmacy. Use the requested one when provided,
  //    otherwise fall back to the first active pharmacy-tier tenant.
  let pharmacyQuery = supabase
    .from('tenants')
    .select('id, name_ar')
    .eq('tier', 'pharmacy')
    .eq('is_active', true);
  pharmacyQuery = requestedPharmacyId
    ? pharmacyQuery.eq('id', requestedPharmacyId)
    : pharmacyQuery.order('created_at', { ascending: true });

  const { data: pharmacy, error: pharmacyErr } = await pharmacyQuery.limit(1).maybeSingle();

  if (pharmacyErr || !pharmacy) {
    return NextResponse.json(
      { error: 'لا توجد صيدلية متاحة لاستلام الروشتة' },
      { status: 404 }
    );
  }
  const pharmacyTenantId = (pharmacy as { id: string }).id;

  // 4. prescription_routing requires a doctor_id (NOT NULL). A self-routed
  //    profile medication ties to the patient's most recent prescribing doctor.
  const { data: lastBooking } = await supabase
    .from('bookings')
    .select('doctor_id')
    .eq('patient_id', patient.patientId)
    .not('doctor_id', 'is', null)
    .order('appointment_datetime', { ascending: false })
    .limit(1)
    .maybeSingle();

  const doctorId = (lastBooking as { doctor_id: string } | null)?.doctor_id ?? null;
  if (!doctorId) {
    return NextResponse.json(
      { error: 'لا يمكن إرسال الدواء للصيدلية بدون طبيب معالج سابق' },
      { status: 409 }
    );
  }

  // 5. Materialise the medication as a prescription health_record (the routing
  //    row references it via health_record_id). Mirrors the doctor clinical
  //    document insert: record_type + title_ar + medications JSONB.
  const { data: healthRecord, error: recordErr } = await supabase
    .from('health_records')
    .insert({
      patient_id: patient.patientId,
      record_type: 'prescription',
      document_type: 'prescription',
      // file_* are NOT NULL on health_records; this is a system-materialised
      // prescription with no uploaded file, so use sentinels.
      file_url: 'system/self-routed-prescription',
      file_name: 'prescription.json',
      mime_type: 'application/json',
      prescription_date: new Date().toISOString().split('T')[0],
      medications: [
        {
          drug_name_ar: med.drug_name_ar,
          drug_name_en: med.drug_name_en,
          dose: med.dose,
          frequency_ar: med.frequency_ar,
          for_condition_ar: med.for_condition_ar,
        },
      ],
    })
    .select('id')
    .single();

  if (recordErr || !healthRecord) {
    return NextResponse.json({ error: 'فشل في حفظ الروشتة' }, { status: 500 });
  }
  const healthRecordId = (healthRecord as { id: string }).id;

  // 6. Create the routing row using the migration-038 columns.
  const { data: routing, error: routingErr } = await supabase
    .from('prescription_routing')
    .insert({
      health_record_id: healthRecordId,
      pharmacy_tenant_id: pharmacyTenantId,
      doctor_id: doctorId,
      patient_id: patient.patientId,
      patient_phone: (patientRow as { phone_number: string }).phone_number,
      status: 'routed',
      routed_at: new Date().toISOString(),
      routing_note_ar: 'تم الإرسال بواسطة المريض من السجل الطبي',
    })
    .select()
    .single();

  if (routingErr || !routing) {
    return NextResponse.json({ error: 'فشل في إرسال الدواء للصيدلية' }, { status: 500 });
  }

  return NextResponse.json({ routing, health_record_id: healthRecordId }, { status: 201 });
}
