import { NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';
import { clinicalDocumentPdfUrl } from '@/lib/clinical-documents/storage';

export const dynamic = 'force-dynamic';

// ─── Timeline record contract (mirrors EnhancedTimeline.tsx) ──────────────────
type RecordType = 'visit' | 'lab' | 'prescription' | 'imaging' | 'follow_up';

interface TimelineRecord {
  id: string;
  type: RecordType;
  date: string;
  encounter_id: string | null;
  // Visit
  chief_complaint_ar?: string;
  chief_complaint_en?: string;
  specialty_ar?: string;
  specialty_en?: string;
  doctor_name_ar?: string;
  doctor_name_en?: string;
  urgency_level?: string;
  outcome?: string;
  // Lab
  test_name_ar?: string;
  test_name_en?: string;
  value?: string;
  unit?: string;
  is_abnormal?: boolean;
  lab_order_id?: string;
  // Prescription
  drug_name_ar?: string;
  drug_name_en?: string;
  dose?: string;
  frequency_ar?: string;
  frequency_en?: string;
  status?: string;
  // Imaging
  imaging_type_ar?: string;
  imaging_type_en?: string;
  report_summary_ar?: string;
  report_summary_en?: string;
  pdf_url?: string;
  // Follow-up
  reason_ar?: string;
  reason_en?: string;
  follow_up_status?: 'scheduled' | 'completed' | 'overdue';
  linked_visit_id?: string;
  days_overdue?: number;
}

// ─── Row shapes ───────────────────────────────────────────────────────────────
interface SummaryRow {
  id: string;
  session_id: string | null;
  chief_complaint_ar: string;
  specialty_name_ar: string | null;
  urgency_level: string | null;
  doctor_name_ar: string | null;
  outcome: string | null;
  created_at: string;
}

interface LabValueItem {
  test_code?: string;
  test_name?: string;
  test_name_en?: string;
  value?: number | string;
  unit?: string;
  reference_range?: string;
  is_abnormal?: boolean;
}

interface LabRecordRow {
  id: string;
  session_id: string | null;
  lab_values: LabValueItem[] | null;
  lab_name: string | null;
  lab_date: string | null;
  uploaded_at: string;
  has_abnormal_values: boolean | null;
}

interface PrescriptionItemRow {
  id: string;
  drug_name_ar: string;
  drug_name_en: string | null;
  dose: string;
  frequency_ar: string;
  frequency_en: string | null;
  health_records: {
    id: string;
    session_id: string | null;
    uploaded_at: string;
    whatsapp_sent: boolean | null;
  } | null;
}

interface ImagingItemRow {
  id: string;
  modality: string;
  modality_ar: string;
  body_region_ar: string | null;
  body_region_en: string | null;
  clinical_indication_ar: string | null;
  clinical_indication_en: string | null;
  health_records: {
    id: string;
    session_id: string | null;
    uploaded_at: string;
    pdf_url: string | null;
  } | null;
}

interface FollowUpRow {
  id: string;
  doctor_id: string;
  booking_id: string | null;
  follow_up_date: string;
  reason_ar: string | null;
  reason_en: string | null;
  status: string;
  created_at: string;
}

// ─── GET /api/patient/medical-record/timeline ─────────────────────────────────
// Aggregates the patient's longitudinal events into a unified, newest-first
// timeline shaped exactly as EnhancedTimeline's TimelineRecord[].
export async function GET() {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createServerClient();
  const pid = patient.patientId;

  const [summariesResult, labsResult, prescriptionsResult, imagingResult, followUpsResult] =
    await Promise.all([
      supabase
        .from('session_summaries')
        .select('id, session_id, chief_complaint_ar, specialty_name_ar, urgency_level, doctor_name_ar, outcome, created_at')
        .eq('patient_id', pid)
        .order('created_at', { ascending: false }),

      supabase
        .from('health_records')
        .select('id, session_id, lab_values, lab_name, lab_date, uploaded_at, has_abnormal_values')
        .eq('patient_id', pid)
        .eq('record_type', 'lab_result')
        .is('deleted_at', null)
        .order('uploaded_at', { ascending: false }),

      supabase
        .from('prescription_items')
        .select('id, drug_name_ar, drug_name_en, dose, frequency_ar, frequency_en, health_records!inner(id, session_id, uploaded_at, whatsapp_sent, patient_id, deleted_at)')
        .eq('health_records.patient_id', pid)
        .is('health_records.deleted_at', null),

      supabase
        .from('imaging_order_items')
        .select('id, modality, modality_ar, body_region_ar, body_region_en, clinical_indication_ar, clinical_indication_en, health_records!inner(id, session_id, uploaded_at, pdf_url, patient_id, deleted_at)')
        .eq('health_records.patient_id', pid)
        .is('health_records.deleted_at', null),

      supabase
        .from('follow_up_schedule')
        .select('id, doctor_id, booking_id, follow_up_date, reason_ar, reason_en, status, created_at')
        .eq('patient_id', pid)
        .neq('status', 'cancelled')
        .order('follow_up_date', { ascending: false }),
    ]);

  const records: TimelineRecord[] = [];

  // ─── Visits (from session summaries) ────────────────────────────────────────
  for (const row of (summariesResult.data as SummaryRow[] | null) ?? []) {
    records.push({
      id: row.id,
      type: 'visit',
      date: row.created_at,
      encounter_id: row.session_id,
      chief_complaint_ar: row.chief_complaint_ar,
      specialty_ar: row.specialty_name_ar ?? undefined,
      doctor_name_ar: row.doctor_name_ar ?? undefined,
      urgency_level: row.urgency_level ?? undefined,
      outcome: row.outcome ?? undefined,
    });
  }

  // ─── Labs (flattened from lab_values JSONB) ─────────────────────────────────
  for (const rec of (labsResult.data as LabRecordRow[] | null) ?? []) {
    const date = rec.lab_date ?? rec.uploaded_at;
    const items = Array.isArray(rec.lab_values) ? rec.lab_values : [];
    if (items.length === 0) {
      records.push({
        id: rec.id,
        type: 'lab',
        date,
        encounter_id: rec.session_id,
        test_name_ar: rec.lab_name ?? 'تحليل',
        is_abnormal: rec.has_abnormal_values ?? undefined,
        lab_order_id: rec.id,
      });
      continue;
    }
    items.forEach((it, idx) => {
      const name = String(it.test_name ?? it.test_code ?? rec.lab_name ?? 'تحليل');
      records.push({
        id: `${rec.id}:${idx}`,
        type: 'lab',
        date,
        encounter_id: rec.session_id,
        test_name_ar: name,
        test_name_en: it.test_name_en ?? name,
        value: it.value != null ? String(it.value) : undefined,
        unit: it.unit ?? undefined,
        is_abnormal: it.is_abnormal ?? (rec.has_abnormal_values ?? undefined),
        lab_order_id: rec.id,
      });
    });
  }

  // ─── Prescriptions (items under doctor-authored records) ────────────────────
  for (const item of (prescriptionsResult.data as PrescriptionItemRow[] | null) ?? []) {
    const hr = item.health_records;
    if (!hr) continue;
    records.push({
      id: item.id,
      type: 'prescription',
      date: hr.uploaded_at,
      encounter_id: hr.session_id,
      drug_name_ar: item.drug_name_ar,
      drug_name_en: item.drug_name_en ?? undefined,
      dose: item.dose,
      frequency_ar: item.frequency_ar,
      frequency_en: item.frequency_en ?? undefined,
      status: hr.whatsapp_sent ? 'sent_to_pharmacy' : 'not_dispensed',
    });
  }

  // ─── Imaging (items under doctor-authored records) ──────────────────────────
  for (const item of (imagingResult.data as ImagingItemRow[] | null) ?? []) {
    const hr = item.health_records;
    if (!hr) continue;
    const typeAr = [item.modality_ar, item.body_region_ar].filter(Boolean).join(' - ');
    const typeEn = [item.modality, item.body_region_en].filter(Boolean).join(' - ');
    records.push({
      id: item.id,
      type: 'imaging',
      date: hr.uploaded_at,
      encounter_id: hr.session_id,
      imaging_type_ar: typeAr || item.modality_ar,
      imaging_type_en: typeEn || item.modality,
      report_summary_ar: item.clinical_indication_ar ?? undefined,
      report_summary_en: item.clinical_indication_en ?? undefined,
      // Private bucket — route through the authorized signing endpoint.
      pdf_url: hr.pdf_url ? clinicalDocumentPdfUrl(hr.id) : undefined,
    });
  }

  // ─── Follow-ups (resolve doctor names, derive overdue) ──────────────────────
  const fuRows = (followUpsResult.data as FollowUpRow[] | null) ?? [];
  const doctorIds = [...new Set(fuRows.map((f) => f.doctor_id).filter(Boolean))];
  const doctorNames = new Map<string, { ar: string; en: string | null }>();
  if (doctorIds.length > 0) {
    const { data: docs } = await supabase
      .from('doctors')
      .select('id, name_ar, name_en')
      .in('id', doctorIds);
    for (const d of (docs as { id: string; name_ar: string; name_en: string | null }[] | null) ?? []) {
      doctorNames.set(d.id, { ar: d.name_ar, en: d.name_en });
    }
  }
  const todayMs = Date.now();
  for (const f of fuRows) {
    const dueMs = new Date(f.follow_up_date).getTime();
    const isOverdue = (f.status === 'scheduled' || f.status === 'reminded' || f.status === 'overdue') && dueMs < todayMs;
    const follow_up_status: 'scheduled' | 'completed' | 'overdue' =
      f.status === 'completed' ? 'completed' : isOverdue ? 'overdue' : 'scheduled';
    const doc = doctorNames.get(f.doctor_id);
    records.push({
      id: f.id,
      type: 'follow_up',
      date: f.follow_up_date,
      encounter_id: f.booking_id,
      doctor_name_ar: doc?.ar ?? undefined,
      doctor_name_en: doc?.en ?? undefined,
      reason_ar: f.reason_ar ?? undefined,
      reason_en: f.reason_en ?? undefined,
      follow_up_status,
      linked_visit_id: f.booking_id ?? undefined,
      ...(isOverdue ? { days_overdue: Math.floor((todayMs - dueMs) / 86400000) } : {}),
    });
  }

  // ─── Sort newest-first ──────────────────────────────────────────────────────
  records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({ records });
}
