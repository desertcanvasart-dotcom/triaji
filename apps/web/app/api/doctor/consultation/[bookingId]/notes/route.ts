import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface DoctorAccount {
  id: string;
  user_id: string;
  doctor_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  last_login_at: string | null;
}

interface RouteContext {
  params: Promise<{ bookingId: string }>;
}

interface NotesBody {
  notes_ar: string;
}

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

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const doctorAccount = await authenticateDoctor(request);

    if (!doctorAccount) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول' },
        { status: 401 }
      );
    }

    const { bookingId } = await context.params;
    const supabase = getServiceClient();

    // Fetch booking and verify ownership
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, doctor_id, session_id')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'الحجز غير موجود' },
        { status: 404 }
      );
    }

    if (booking.doctor_id !== doctorAccount.doctor_id) {
      return NextResponse.json(
        { error: 'غير مصرح بالوصول لهذا الحجز' },
        { status: 403 }
      );
    }

    if (!booking.session_id) {
      return NextResponse.json(
        { error: 'لا توجد جلسة فرز مرتبطة بهذا الحجز' },
        { status: 400 }
      );
    }

    const body = (await request.json()) as NotesBody;

    if (!body.notes_ar || typeof body.notes_ar !== 'string') {
      return NextResponse.json(
        { error: 'ملاحظات الطبيب مطلوبة' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('session_summaries')
      .update({
        doctor_notes_ar: body.notes_ar,
        doctor_notes_added_at: new Date().toISOString(),
        doctor_id: doctorAccount.doctor_id,
      })
      .eq('session_id', booking.session_id);

    if (updateError) {
      return NextResponse.json(
        { error: 'فشل في حفظ الملاحظات' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}
