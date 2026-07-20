import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ─── Helpers ────────────────────────────────────────────────────────────────

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

async function authenticateDoctor(request: NextRequest): Promise<{ id: string } | null> {
  const accessToken = request.cookies.get('sb-access-token')?.value
    ?? request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!accessToken) return null;

  const anonClient = getAnonClient();
  const { data: { user }, error } = await anonClient.auth.getUser(accessToken);
  if (error || !user) return null;

  const supabase = getServiceClient();
  const { data: doctorAccount } = await supabase
    .from('doctor_accounts')
    .select('id, verification_status')
    .eq('id', user.id)
    .single();

  if (!doctorAccount || doctorAccount.verification_status !== 'verified') return null;
  return { id: doctorAccount.id as string };
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface CallSettingsBody {
  /** Legacy field — if present it must match the authenticated doctor. */
  doctorAccountId?: string;
  fee?: number;
  enabled?: boolean;
  maxDuration?: number;
  availability?: Record<string, [string, string]>;
}

// ─── POST /api/doctor/gp-call-settings ──────────────────────────────────────
// Save video call configuration for a doctor.

export async function POST(request: NextRequest) {
  try {
    // Doctors may only modify their own call settings.
    const doctor = await authenticateDoctor(request);
    if (!doctor) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as CallSettingsBody;

    if (body.doctorAccountId && body.doctorAccountId !== doctor.id) {
      return NextResponse.json(
        { error: 'غير مصرح بتعديل إعدادات طبيب آخر' },
        { status: 403 }
      );
    }

    const doctorAccountId = doctor.id;
    const supabase = getServiceClient();

    // ── Build update payload ─────────────────────────────────────────────

    const update: Record<string, unknown> = {};

    if (body.fee !== undefined) {
      if (body.fee < 0) {
        return NextResponse.json(
          { error: 'رسوم المكالمة لا يمكن أن تكون سالبة' },
          { status: 400 }
        );
      }
      update.gp_video_call_fee_egp = body.fee;
    }

    if (body.enabled !== undefined) {
      update.gp_video_calls_enabled = body.enabled;
    }

    if (body.maxDuration !== undefined) {
      if (body.maxDuration < 5 || body.maxDuration > 120) {
        return NextResponse.json(
          { error: 'مدة المكالمة يجب أن تكون بين 5 و 120 دقيقة' },
          { status: 400 }
        );
      }
      update.max_call_duration_minutes = body.maxDuration;
    }

    if (body.availability !== undefined) {
      // Validate availability format
      const validDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

      for (const [day, window] of Object.entries(body.availability)) {
        if (!validDays.includes(day)) {
          return NextResponse.json(
            { error: `يوم غير صالح: ${day}` },
            { status: 400 }
          );
        }
        if (!Array.isArray(window) || window.length !== 2) {
          return NextResponse.json(
            { error: `نافذة الوقت غير صالحة لليوم: ${day}` },
            { status: 400 }
          );
        }
        if (!timeRegex.test(window[0]) || !timeRegex.test(window[1])) {
          return NextResponse.json(
            { error: `صيغة الوقت غير صالحة لليوم: ${day}. استخدم HH:MM` },
            { status: 400 }
          );
        }
        if (window[0] >= window[1]) {
          return NextResponse.json(
            { error: `وقت البداية يجب أن يكون قبل وقت النهاية لليوم: ${day}` },
            { status: 400 }
          );
        }
      }

      update.video_call_availability = body.availability;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: 'لا توجد بيانات لتحديثها' },
        { status: 400 }
      );
    }

    // ── Persist ──────────────────────────────────────────────────────────

    const { error: updateError } = await supabase
      .from('doctor_accounts')
      .update(update)
      .eq('id', doctorAccountId);

    if (updateError) {
      console.error('[GP Settings] Update error:', updateError);
      return NextResponse.json({ error: 'فشل في حفظ الإعدادات' }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: Object.keys(update) });
  } catch (err) {
    console.error('[GP Settings] Error:', err);
    return NextResponse.json({ error: 'فشل في حفظ إعدادات المكالمات' }, { status: 500 });
  }
}
