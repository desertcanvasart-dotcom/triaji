import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateDoctorAccount,
  getDoctorServiceClient,
} from '@/lib/auth/doctor-account';

export const dynamic = 'force-dynamic';

const BUCKET = 'doctor-documents';

const T = {
  unauthorised: { ar: 'غير مصرح. سجّل دخولك الأول', en: 'Not authorised. Please sign in.' },
  notFound: { ar: 'المستند مش موجود', en: 'Document not found' },
  locked: {
    ar: 'المستند ده تمت الموافقة عليه ومش ممكن تحذفه',
    en: 'This document has been approved and can no longer be removed',
  },
  failed: { ar: 'حصلت مشكلة، حاول تاني', en: 'Something went wrong, please try again' },
} as const;

/** DELETE /api/doctor/documents/[id] — remove one of your own uploads */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const l = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ar';
  const account = await authenticateDoctorAccount(request);
  if (!account) return NextResponse.json({ error: T.unauthorised[l] }, { status: 401 });

  const { id } = await params;
  const supabase = getDoctorServiceClient();

  // Scoped to the caller's own account — an id alone must not be enough.
  const { data: doc } = await supabase
    .from('doctor_documents')
    .select('id, storage_path, status')
    .eq('id', id)
    .eq('doctor_account_id', account.id)
    .maybeSingle();

  if (!doc) return NextResponse.json({ error: T.notFound[l] }, { status: 404 });
  if (doc.status === 'approved') {
    return NextResponse.json({ error: T.locked[l] }, { status: 409 });
  }

  const { error } = await supabase.from('doctor_documents').delete().eq('id', doc.id);
  if (error) {
    return NextResponse.json({ error: T.failed[l] }, { status: 500 });
  }

  await supabase.storage.from(BUCKET).remove([doc.storage_path as string]);

  return NextResponse.json({ success: true });
}
