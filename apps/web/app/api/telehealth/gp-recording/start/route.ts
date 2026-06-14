import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ─── Config ─────────────────────────────────────────────────────────────────

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const SUPABASE_SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

function getServiceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Missing Supabase env vars');
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isLiveKitConfigured(): boolean {
  return !!(LIVEKIT_API_KEY && LIVEKIT_API_SECRET && LIVEKIT_URL);
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface StartRecordingBody {
  callId: string;
}

interface CallRow {
  id: string;
  livekit_room_name: string;
  status: string;
  is_recorded: boolean;
}

// ─── POST /api/telehealth/gp-recording/start ────────────────────────────────
// Start egress recording for a GP video call. Doctor-only.

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as StartRecordingBody;

    if (!body.callId) {
      return NextResponse.json({ error: 'callId is required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // ── Load call ────────────────────────────────────────────────────────

    const { data: call } = await supabase
      .from('gp_video_calls')
      .select('id, livekit_room_name, status, is_recorded')
      .eq('id', body.callId)
      .single() as { data: CallRow | null };

    if (!call) {
      return NextResponse.json({ error: 'المكالمة غير موجودة' }, { status: 404 });
    }

    if (!['accepted', 'in_progress'].includes(call.status)) {
      return NextResponse.json(
        { error: 'لا يمكن بدء التسجيل — المكالمة ليست نشطة' },
        { status: 422 }
      );
    }

    if (call.is_recorded) {
      return NextResponse.json(
        { error: 'التسجيل قيد التشغيل بالفعل' },
        { status: 409 }
      );
    }

    // ── Start egress recording ───────────────────────────────────────────

    let egressId: string | null = null;

    if (isLiveKitConfigured()) {
      try {
        const { EgressClient, EncodedFileOutput, EncodedFileType } = await import('livekit-server-sdk');
        const egressClient = new EgressClient(
          LIVEKIT_URL!,
          LIVEKIT_API_KEY!,
          LIVEKIT_API_SECRET!
        );

        const outputPath = `gp-recordings/${body.callId}/${Date.now()}.mp4`;

        // Record as room composite to Supabase Storage via S3-compatible API
        const output = new EncodedFileOutput({
          filepath: outputPath,
          fileType: EncodedFileType.MP4,
          output: {
            case: 's3',
            value: {
              bucket: 'gp-recordings',
              region: 'auto',
              endpoint: `${SUPABASE_URL}/storage/v1/s3`,
              accessKey: SUPABASE_SERVICE_KEY,
              secret: SUPABASE_SERVICE_KEY,
              forcePathStyle: true,
            },
          },
        });

        const egress = await egressClient.startRoomCompositeEgress(
          call.livekit_room_name,
          { file: output }
        );

        egressId = egress.egressId;
      } catch (err) {
        console.error('[GP Video] Failed to start egress recording:', err);
        return NextResponse.json(
          { error: 'فشل في بدء التسجيل' },
          { status: 500 }
        );
      }
    } else {
      console.log('[GP Video DEV_MODE] Would start recording for room:', call.livekit_room_name);
      egressId = `dev-egress-${Date.now()}`;
    }

    // ── Update call record ───────────────────────────────────────────────

    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // +90 days

    await supabase
      .from('gp_video_calls')
      .update({
        is_recorded: true,
        recording_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.callId);

    return NextResponse.json({
      callId: body.callId,
      egressId,
      recording: true,
      expiresAt,
    });
  } catch (err) {
    console.error('[GP Video] Start recording error:', err);
    return NextResponse.json({ error: 'فشل في بدء التسجيل' }, { status: 500 });
  }
}
