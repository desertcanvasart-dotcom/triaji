import { NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';
import { clinicalDocumentPdfUrl } from '@/lib/clinical-documents/storage';

// GET /api/patient/history — patient's session summaries + doctor-authored documents
export async function GET() {
  const patient = await getAuthenticatedPatient();
  if (!patient) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createServerClient();

  const [summariesResult, documentsResult] = await Promise.all([
    supabase
      .from('session_summaries')
      .select('*')
      .eq('patient_id', patient.patientId)
      .order('created_at', { ascending: false }),
    supabase
      .from('health_records')
      .select(
        'id, session_id, record_type, file_name, uploaded_at, summary_ar, summary_en, doctor_authored, document_type, document_number, whatsapp_sent, whatsapp_sent_at, pdf_url, authored_by'
      )
      .eq('patient_id', patient.patientId)
      .eq('doctor_authored', true)
      .is('deleted_at', null)
      .order('uploaded_at', { ascending: false }),
  ]);

  if (summariesResult.error) {
    return NextResponse.json({ error: summariesResult.error.message }, { status: 500 });
  }

  // The bucket is private — expose the authorized signing endpoint, not the
  // stored path (or legacy public URL, which never worked).
  const clinicalDocuments = (documentsResult.data ?? []).map((doc) => ({
    ...doc,
    pdf_url: doc.pdf_url ? clinicalDocumentPdfUrl(doc.id as string) : null,
  }));

  return NextResponse.json({
    summaries: summariesResult.data ?? [],
    clinical_documents: clinicalDocuments,
  });
}
