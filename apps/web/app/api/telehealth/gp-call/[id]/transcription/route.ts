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

// ─── Types ──────────────────────────────────────────────────────────────────

interface CallRow {
  id: string;
  doctor_account_id: string;
  transcription_status: string;
  transcription_ar: string | null;
  structured_notes_ar: string | null;
  duration_seconds: number | null;
  initiated_at: string;
  ended_at: string | null;
}

// ─── GET /api/telehealth/gp-call/[id]/transcription ─────────────────────────
// Get transcription and structured notes for a GP video call. Doctor-only.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const doctorAccountId = searchParams.get('doctorAccountId');

    if (!doctorAccountId) {
      return NextResponse.json(
        { error: 'doctorAccountId is required' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // ── Load call ────────────────────────────────────────────────────────

    const { data: call } = await supabase
      .from('gp_video_calls')
      .select('id, doctor_account_id, transcription_status, transcription_ar, structured_notes_ar, duration_seconds, initiated_at, ended_at')
      .eq('id', id)
      .single() as { data: CallRow | null };

    if (!call) {
      return NextResponse.json({ error: 'المكالمة غير موجودة' }, { status: 404 });
    }

    // ── Auth: doctor only ────────────────────────────────────────────────

    if (call.doctor_account_id !== doctorAccountId) {
      return NextResponse.json(
        { error: 'غير مصرح — التفريغ متاح للطبيب فقط' },
        { status: 403 }
      );
    }

    // ── Check transcription status ──────────────────────────────────────

    if (call.transcription_status === 'not_started') {
      return NextResponse.json({
        callId: id,
        status: 'not_started',
        message: 'لم يبدأ التفريغ بعد',
      });
    }

    if (call.transcription_status === 'processing') {
      return NextResponse.json({
        callId: id,
        status: 'processing',
        message: 'التفريغ قيد المعالجة',
      });
    }

    if (call.transcription_status === 'failed') {
      return NextResponse.json({
        callId: id,
        status: 'failed',
        message: 'فشل التفريغ — يمكنك إعادة المحاولة',
      });
    }

    // ── Parse structured notes ──────────────────────────────────────────

    let structuredNotes = null;
    if (call.structured_notes_ar) {
      try {
        structuredNotes = JSON.parse(call.structured_notes_ar);
      } catch {
        structuredNotes = { raw: call.structured_notes_ar };
      }
    }

    return NextResponse.json({
      callId: id,
      status: 'complete',
      transcription: call.transcription_ar,
      structuredNotes,
      callInfo: {
        durationSeconds: call.duration_seconds,
        initiatedAt: call.initiated_at,
        endedAt: call.ended_at,
      },
    });
  } catch (err) {
    console.error('[Transcription] GET error:', err);
    return NextResponse.json({ error: 'فشل في تحميل التفريغ' }, { status: 500 });
  }
}
