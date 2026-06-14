import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DoctorAccount {
  id: string;
  user_id: string;
  doctor_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
}

interface SettingsUpdatePayload {
  signature_url?: string;
  stamp_url?: string;
  use_text_stamp?: boolean;
  clinic_name_ar?: string;
  clinic_name_en?: string;
  clinic_address_ar?: string;
  clinic_address_en?: string;
  clinic_phone?: string;
}

const ALLOWED_FIELDS: (keyof SettingsUpdatePayload)[] = [
  'signature_url',
  'stamp_url',
  'use_text_stamp',
  'clinic_name_ar',
  'clinic_name_en',
  'clinic_address_ar',
  'clinic_address_en',
  'clinic_phone',
];

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
    .eq('user_id', user.id)
    .single();

  if (!doctorAccount || doctorAccount.verification_status !== 'verified') return null;
  return doctorAccount as DoctorAccount;
}

// ─── GET /api/doctor/settings ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const doctorAccount = await authenticateDoctor(request);

    if (!doctorAccount) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول' },
        { status: 401 }
      );
    }

    const supabase = getServiceClient();

    const { data: doctor, error: doctorError } = await supabase
      .from('doctor_accounts')
      .select(`
        id,
        doctor_id,
        name_ar,
        name_en,
        specialty_name_ar,
        syndicate_number,
        email,
        phone,
        signature_url,
        stamp_url,
        use_text_stamp,
        clinic_name_ar,
        clinic_name_en,
        clinic_address_ar,
        clinic_address_en,
        clinic_phone
      `)
      .eq('id', doctorAccount.id)
      .single();

    if (doctorError || !doctor) {
      return NextResponse.json(
        { error: 'فشل في جلب الإعدادات' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      settings: {
        ...doctor,
        use_text_stamp: doctor.use_text_stamp ?? false,
        clinic_name_ar: doctor.clinic_name_ar ?? '',
        clinic_name_en: doctor.clinic_name_en ?? '',
        clinic_address_ar: doctor.clinic_address_ar ?? '',
        clinic_address_en: doctor.clinic_address_en ?? '',
        clinic_phone: doctor.clinic_phone ?? '',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// ─── PUT /api/doctor/settings ───────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const doctorAccount = await authenticateDoctor(request);

    if (!doctorAccount) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;

    // Filter to only allowed fields
    const updates: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'لا توجد بيانات للتحديث' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    const { data: updated, error: updateError } = await supabase
      .from('doctor_accounts')
      .update(updates)
      .eq('id', doctorAccount.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'فشل في تحديث الإعدادات' },
        { status: 500 }
      );
    }

    return NextResponse.json({ settings: updated });
  } catch {
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}
