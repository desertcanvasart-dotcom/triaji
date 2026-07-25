import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedPatient } from '@/lib/auth/get-patient';

export const dynamic = 'force-dynamic';

const BUCKET = 'session-images';
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SIGNED_URL_TTL_SECONDS = 3600;

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const T = {
  badSession: { ar: 'الجلسة مش موجودة', en: 'Session not found' },
  closedSession: { ar: 'الجلسة دي اتقفلت', en: 'This session is closed' },
  forbidden: { ar: 'غير مصرح', en: 'Not authorised' },
  noFile: { ar: 'لم يتم إرفاق صورة', en: 'No image attached' },
  badType: { ar: 'يُسمح فقط بصور JPEG أو PNG أو WEBP', en: 'Only JPEG, PNG or WEBP images are allowed' },
  tooBig: {
    ar: 'الصورة أكبر من 10 ميجابايت، من فضلك اختر صورة أصغر',
    en: 'The image is larger than 10MB, please choose a smaller one',
  },
  failed: { ar: 'حدث خطأ في رفع الصورة، حاول مرة أخرى', en: 'Image upload failed, please try again' },
} as const;

function extensionFor(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * POST /api/patient/session-image — attach an image to a triage session.
 *
 * Uploads run here rather than from the browser: session-images is private and
 * holds patient photos, so the alternative was an anon-writable storage policy
 * that would let anyone holding the public key read and write the whole bucket.
 * The service-role client bypasses RLS, and access is gated below instead.
 *
 * Once a session belongs to a patient, only that patient may add to it. Sessions
 * started anonymously (widget, kiosk — patient_id is nullable in practice) are
 * held by their unguessable id, the same capability the rest of that flow uses.
 */
export async function POST(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ar';

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const sessionId = (formData.get('session_id') as string | null)?.trim();

    if (!sessionId) {
      return NextResponse.json({ error: T.badSession[lang] }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: T.noFile[lang] }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: T.badType[lang] }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: T.tooBig[lang] }, { status: 400 });
    }

    const supabase = getServiceClient();

    const { data: session } = await supabase
      .from('triage_sessions')
      .select('id, patient_id, status')
      .eq('id', sessionId)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: T.badSession[lang] }, { status: 404 });
    }
    if (session.status !== 'active') {
      return NextResponse.json({ error: T.closedSession[lang] }, { status: 409 });
    }

    if (session.patient_id) {
      const patient = await getAuthenticatedPatient();
      if (!patient || patient.patientId !== session.patient_id) {
        return NextResponse.json({ error: T.forbidden[lang] }, { status: 403 });
      }
    }

    const randomId = Math.random().toString(36).slice(2, 10);
    const path = `${sessionId}/${Date.now()}-${randomId}.${extensionFor(file.type)}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('[patient/session-image] upload failed:', uploadError.message);
      return NextResponse.json({ error: T.failed[lang] }, { status: 500 });
    }

    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    return NextResponse.json({
      success: true,
      url: path,
      publicUrl: signed?.signedUrl ?? null,
      mimeType: file.type,
      sizeBytes: file.size,
    });
  } catch {
    return NextResponse.json({ error: T.failed[lang] }, { status: 500 });
  }
}
