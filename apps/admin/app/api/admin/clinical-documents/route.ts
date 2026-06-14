import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface HealthRecord {
  id: string;
  document_number: string | null;
  document_type: string | null;
  record_type: string;
  pdf_url: string | null;
  whatsapp_sent: boolean | null;
  whatsapp_sent_at: string | null;
  created_at: string;
  authored_by: string | null;
  patient_id: string;
}

interface DoctorInfo {
  id: string;
  name_ar: string;
  name_en: string | null;
  specialty_ar: string;
}

interface PatientInfo {
  id: string;
  phone_number: string;
  name_ar: string | null;
}

interface ClinicalDocumentRecord {
  id: string;
  documentNumber: string;
  documentType: string;
  pdfUrl: string | null;
  whatsappSent: boolean;
  whatsappSentAt: string | null;
  createdAt: string;
  doctorName: string;
  patientName: string;
}

/** GET /api/admin/clinical-documents — audit view of doctor-authored clinical documents */
export async function GET(request: NextRequest) {
  const authResult = await authenticateAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { admin } = authResult;

  if (admin.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Platform admin access required.' },
      { status: 403 }
    );
  }

  const supabase = createAdminClient();

  const { searchParams } = request.nextUrl;
  const documentType = searchParams.get('document_type');
  const doctorSearch = searchParams.get('doctor_name');
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '25', 10);
  const offset = (page - 1) * limit;

  // If filtering by doctor name, first find matching doctor IDs
  let doctorIdFilter: string[] | null = null;
  if (doctorSearch && doctorSearch.trim()) {
    const { data: matchingDoctors } = await supabase
      .from('doctor_accounts')
      .select('id')
      .or(`name_ar.ilike.%${doctorSearch.trim()}%,name_en.ilike.%${doctorSearch.trim()}%`);

    if (matchingDoctors && matchingDoctors.length > 0) {
      doctorIdFilter = (matchingDoctors as { id: string }[]).map((d) => d.id);
    } else {
      // No matching doctors — return empty results
      return NextResponse.json({
        documents: [],
        total: 0,
        page,
        limit,
      });
    }
  }

  // Query health_records where doctor_authored = true
  let query = supabase
    .from('health_records')
    .select('*', { count: 'exact' })
    .eq('doctor_authored', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (documentType && documentType !== 'all') {
    query = query.eq('document_type', documentType);
  }

  if (doctorIdFilter) {
    query = query.in('authored_by', doctorIdFilter);
  }

  const { data: records, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const typedRecords = (records ?? []) as HealthRecord[];

  // Collect unique authored_by IDs and patient_ids for batch lookups
  const authorIds = [...new Set(typedRecords.map((r) => r.authored_by).filter(Boolean))] as string[];
  const patientIds = [...new Set(typedRecords.map((r) => r.patient_id))];

  // Fetch doctor accounts
  const doctorMap = new Map<string, DoctorInfo>();
  if (authorIds.length > 0) {
    const { data: doctors } = await supabase
      .from('doctor_accounts')
      .select('id, name_ar, name_en, specialty_ar')
      .in('id', authorIds);
    if (doctors) {
      for (const doc of doctors as DoctorInfo[]) {
        doctorMap.set(doc.id, doc);
      }
    }
  }

  // Fetch patients
  const patientMap = new Map<string, PatientInfo>();
  if (patientIds.length > 0) {
    const { data: patients } = await supabase
      .from('patients')
      .select('id, phone_number, name_ar')
      .in('id', patientIds);
    if (patients) {
      for (const pat of patients as PatientInfo[]) {
        patientMap.set(pat.id, pat);
      }
    }
  }

  // Build response
  const documents: ClinicalDocumentRecord[] = typedRecords.map((record) => {
    const doctor = record.authored_by ? doctorMap.get(record.authored_by) : null;
    const patient = patientMap.get(record.patient_id);

    return {
      id: record.id,
      documentNumber: record.document_number ?? '\u2014',
      documentType: record.document_type ?? record.record_type,
      pdfUrl: record.pdf_url,
      whatsappSent: record.whatsapp_sent ?? false,
      whatsappSentAt: record.whatsapp_sent_at,
      createdAt: record.created_at,
      doctorName: doctor?.name_ar ?? '\u2014',
      patientName: patient?.name_ar ?? '\u2014',
    };
  });

  return NextResponse.json({
    documents,
    total: count ?? 0,
    page,
    limit,
  });
}
