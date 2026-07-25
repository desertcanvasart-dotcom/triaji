import { NextRequest, NextResponse } from 'next/server';
import {
  DOCTOR_DOCUMENT_MAX_BYTES,
  DOCTOR_DOCUMENT_MIME_TYPES,
  DOCTOR_DOCUMENT_TYPES,
  type DoctorDocumentType,
} from '@triaji/shared/constants/doctor-documents';
import {
  authenticateDoctorAccount,
  getDoctorServiceClient,
} from '@/lib/auth/doctor-account';

export const dynamic = 'force-dynamic';

const BUCKET = 'doctor-documents';

const T = {
  unauthorised: { ar: 'غير مصرح. سجّل دخولك الأول', en: 'Not authorised. Please sign in.' },
  badType: { ar: 'نوع المستند غير صحيح', en: 'Invalid document type' },
  noFile: { ar: 'لم يتم إرفاق ملف', en: 'No file attached' },
  badMime: {
    ar: 'الملف لازم يكون صورة (JPEG أو PNG أو WebP) أو PDF',
    en: 'File must be an image (JPEG, PNG, WebP) or a PDF',
  },
  tooBig: { ar: 'حجم الملف كبير. الحد الأقصى ١٠ ميجابايت', en: 'File too large. Maximum is 10MB' },
  uploadFailed: { ar: 'فشل رفع الملف، حاول تاني', en: 'Upload failed, please try again' },
  notFound: { ar: 'المستند مش موجود', en: 'Document not found' },
  locked: {
    ar: 'المستند ده تمت الموافقة عليه ومش ممكن تحذفه',
    en: 'This document has been approved and can no longer be removed',
  },
} as const;

function lang(request: NextRequest): 'ar' | 'en' {
  return request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ar';
}

function extensionFor(mime: string, fileName: string): string {
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/jpeg') return 'jpg';
  return fileName.split('.').pop() ?? 'bin';
}

/** GET /api/doctor/documents — the signed-in doctor's own uploads */
export async function GET(request: NextRequest) {
  const l = lang(request);
  const account = await authenticateDoctorAccount(request);
  if (!account) return NextResponse.json({ error: T.unauthorised[l] }, { status: 401 });

  const supabase = getDoctorServiceClient();
  const { data, error } = await supabase
    .from('doctor_documents')
    .select('id, doc_type, file_name, mime_type, size_bytes, status, review_note, uploaded_at, reviewed_at')
    .eq('doctor_account_id', account.id)
    .order('uploaded_at', { ascending: false });

  if (error) {
    // The table only exists once migration 068 is applied — show the checklist
    // rather than a dead page.
    if (/doctor_documents/.test(error.message)) {
      console.warn('[doctor/documents] table missing (apply migration 068):', error.message);
      return NextResponse.json({
        documents: [],
        clinic_mode: account.clinic_mode ?? 'independent',
        verification_status: account.verification_status,
        migration_pending: true,
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    documents: data ?? [],
    clinic_mode: account.clinic_mode ?? 'independent',
    verification_status: account.verification_status,
  });
}

/** POST /api/doctor/documents — upload one document (multipart) */
export async function POST(request: NextRequest) {
  const l = lang(request);
  const account = await authenticateDoctorAccount(request);
  if (!account) return NextResponse.json({ error: T.unauthorised[l] }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const docType = formData.get('doc_type') as string | null;

  if (!docType || !DOCTOR_DOCUMENT_TYPES.includes(docType as DoctorDocumentType)) {
    return NextResponse.json({ error: T.badType[l] }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: T.noFile[l] }, { status: 400 });
  }
  if (!DOCTOR_DOCUMENT_MIME_TYPES.includes(file.type as (typeof DOCTOR_DOCUMENT_MIME_TYPES)[number])) {
    return NextResponse.json({ error: T.badMime[l] }, { status: 400 });
  }
  if (file.size > DOCTOR_DOCUMENT_MAX_BYTES) {
    return NextResponse.json({ error: T.tooBig[l] }, { status: 400 });
  }

  const supabase = getDoctorServiceClient();

  // Re-uploading a type replaces the previous attempt — that's the whole point
  // of the rejected → fix → resubmit loop, and it keeps the queue to one row
  // per document type.
  const { data: existing } = await supabase
    .from('doctor_documents')
    .select('id, storage_path, status')
    .eq('doctor_account_id', account.id)
    .eq('doc_type', docType);

  const stamp = Date.now();
  const storagePath = `${account.id}/${docType}-${stamp}.${extensionFor(file.type, file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error('[doctor/documents] upload failed:', uploadError.message);
    return NextResponse.json({ error: T.uploadFailed[l] }, { status: 500 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from('doctor_documents')
    .insert({
      doctor_account_id: account.id,
      doc_type: docType,
      storage_path: storagePath,
      file_name: file.name.slice(0, 200),
      mime_type: file.type,
      size_bytes: file.size,
      status: 'pending',
    })
    .select('id, doc_type, file_name, mime_type, size_bytes, status, review_note, uploaded_at, reviewed_at')
    .single();

  if (insertError) {
    // Don't leave the object orphaned in the bucket.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    console.error('[doctor/documents] insert failed:', insertError.message);
    return NextResponse.json({ error: T.uploadFailed[l] }, { status: 500 });
  }

  // Only drop the superseded rows once the replacement is safely stored.
  const superseded = (existing ?? []).filter((d) => d.status !== 'approved');
  if (superseded.length > 0) {
    await supabase.storage.from(BUCKET).remove(superseded.map((d) => d.storage_path as string));
    await supabase
      .from('doctor_documents')
      .delete()
      .in('id', superseded.map((d) => d.id as string));
  }

  return NextResponse.json({ success: true, document: inserted }, { status: 201 });
}
