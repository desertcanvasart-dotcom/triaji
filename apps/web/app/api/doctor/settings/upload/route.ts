import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DoctorAccount {
  id: string;
  doctor_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
}

type UploadType = 'signature' | 'stamp';

const VALID_TYPES: UploadType[] = ['signature', 'stamp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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

// ─── Auth Helper ────────────────────────────────────────────────────────────

async function authenticateDoctor(request: NextRequest): Promise<DoctorAccount | null> {
  const accessToken = request.cookies.get('sb-access-token')?.value
    ?? request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!accessToken) return null;

  const anonClient = getAnonClient();
  const { data: { user }, error } = await anonClient.auth.getUser(accessToken);
  if (error || !user) return null;

  const supabase = getServiceClient();
  const { data: doctorAccount } = await supabase
    .from('doctor_accounts')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!doctorAccount || doctorAccount.verification_status !== 'verified') return null;
  return doctorAccount as DoctorAccount;
}

// ─── POST /api/doctor/settings/upload ───────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const doctorAccount = await authenticateDoctor(request);

    if (!doctorAccount) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const uploadType = formData.get('type') as string | null;

    // Validate type
    if (!uploadType || !VALID_TYPES.includes(uploadType as UploadType)) {
      return NextResponse.json(
        { error: 'نوع الرفع غير صالح. يجب أن يكون signature أو stamp' },
        { status: 400 }
      );
    }

    // Validate file
    if (!file) {
      return NextResponse.json(
        { error: 'لم يتم إرفاق ملف' },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'نوع الملف غير مدعوم. يرجى رفع صورة بصيغة JPEG أو PNG أو WebP' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'حجم الملف كبير جداً. الحد الأقصى ٥ ميجابايت' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `${doctorAccount.doctor_id}/${uploadType}.png`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('doctor-assets')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: 'فشل في رفع الملف' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('doctor-assets')
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // Update doctor_accounts with the URL
    const updateField = uploadType === 'signature' ? 'signature_url' : 'stamp_url';

    const { error: updateError } = await supabase
      .from('doctor_accounts')
      .update({ [updateField]: publicUrl })
      .eq('id', doctorAccount.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'تم رفع الملف لكن فشل تحديث البيانات' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: publicUrl });
  } catch {
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}
