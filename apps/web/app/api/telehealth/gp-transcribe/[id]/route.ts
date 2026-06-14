import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { transcribeGpCall } from '@/lib/telehealth/transcribe';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes — transcription can be slow

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
  is_recorded: boolean;
  recording_url: string | null;
  transcription_status: string;
}

// ─── POST /api/telehealth/gp-transcribe/[id] ───────────────────────────────
// Trigger transcription for a GP video call. Internal service-role endpoint.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // ── Auth: service-role only ──────────────────────────────────────────

    const serviceKey = request.headers.get('x-service-key');
    if (serviceKey !== process.env['SUPABASE_SERVICE_ROLE_KEY']) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceClient();

    // ── Validate call exists and has recording ──────────────────────────

    const { data: call } = await supabase
      .from('gp_video_calls')
      .select('id, is_recorded, recording_url, transcription_status')
      .eq('id', id)
      .single() as { data: CallRow | null };

    if (!call) {
      return NextResponse.json({ error: 'المكالمة غير موجودة' }, { status: 404 });
    }

    if (!call.is_recorded || !call.recording_url) {
      return NextResponse.json(
        { error: 'لا يوجد تسجيل لهذه المكالمة' },
        { status: 422 }
      );
    }

    if (call.transcription_status === 'processing') {
      return NextResponse.json(
        { error: 'التفريغ قيد المعالجة بالفعل', status: 'processing' },
        { status: 409 }
      );
    }

    if (call.transcription_status === 'complete') {
      return NextResponse.json(
        { message: 'التفريغ مكتمل بالفعل', status: 'complete' },
        { status: 200 }
      );
    }

    // ── Run transcription asynchronously ────────────────────────────────
    // We respond immediately and let transcription run in the background
    // via the waitUntil pattern for Edge/Serverless.

    // Start transcription in background (fire-and-forget within this request)
    transcribeGpCall(id).catch((err) => {
      console.error(`[Transcription] Background transcription failed for ${id}:`, err);
    });

    return NextResponse.json({
      callId: id,
      status: 'processing',
      message: 'بدأ تفريغ المكالمة',
    });
  } catch (err) {
    console.error('[Transcription] Trigger error:', err);
    return NextResponse.json({ error: 'فشل في بدء التفريغ' }, { status: 500 });
  }
}
