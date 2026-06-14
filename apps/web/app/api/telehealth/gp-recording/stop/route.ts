import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ─── Config ─────────────────────────────────────────────────────────────────

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function isLiveKitConfigured(): boolean {
  return !!(LIVEKIT_API_KEY && LIVEKIT_API_SECRET && LIVEKIT_URL);
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface StopRecordingBody {
  callId: string;
}

interface CallRow {
  id: string;
  livekit_room_name: string;
  is_recorded: boolean;
}

// ─── POST /api/telehealth/gp-recording/stop ─────────────────────────────────
// Stop egress recording for a GP video call. Doctor-only.

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as StopRecordingBody;

    if (!body.callId) {
      return NextResponse.json({ error: 'callId is required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // ── Load call ────────────────────────────────────────────────────────

    const { data: call } = await supabase
      .from('gp_video_calls')
      .select('id, livekit_room_name, is_recorded')
      .eq('id', body.callId)
      .single() as { data: CallRow | null };

    if (!call) {
      return NextResponse.json({ error: 'المكالمة غير موجودة' }, { status: 404 });
    }

    if (!call.is_recorded) {
      return NextResponse.json(
        { error: 'لا يوجد تسجيل نشط لهذه المكالمة' },
        { status: 422 }
      );
    }

    // ── Stop egress recording ────────────────────────────────────────────

    let recordingUrl: string | null = null;

    if (isLiveKitConfigured()) {
      try {
        const { EgressClient } = await import('livekit-server-sdk');
        const egressClient = new EgressClient(
          LIVEKIT_URL!,
          LIVEKIT_API_KEY!,
          LIVEKIT_API_SECRET!
        );

        // List active egresses for the room and stop them
        const egresses = await egressClient.listEgress({ roomName: call.livekit_room_name });

        for (const egress of egresses) {
          if (egress.status !== undefined && egress.status <= 2) {
            // Status 0=STARTING, 1=ACTIVE, 2=ENDING — stop active ones
            await egressClient.stopEgress(egress.egressId);
          }

          // Build recording URL from egress file results
          if (egress.fileResults && egress.fileResults.length > 0) {
            const fileResult = egress.fileResults[0];
            if (fileResult) {
              recordingUrl = fileResult.filename ?? null;
            }
          }
        }

        // If no URL from egress results, construct from storage bucket
        if (!recordingUrl) {
          const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
          recordingUrl = `${supabaseUrl}/storage/v1/object/gp-recordings/${body.callId}/`;
        }
      } catch (err) {
        console.error('[GP Video] Failed to stop egress recording:', err);
        return NextResponse.json({ error: 'فشل في إيقاف التسجيل' }, { status: 500 });
      }
    } else {
      console.log('[GP Video DEV_MODE] Would stop recording for room:', call.livekit_room_name);
      recordingUrl = `dev-recording-${body.callId}.mp4`;
    }

    // ── Update call record ───────────────────────────────────────────────

    await supabase
      .from('gp_video_calls')
      .update({
        recording_url: recordingUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.callId);

    return NextResponse.json({
      callId: body.callId,
      recording: false,
      recordingUrl,
    });
  } catch (err) {
    console.error('[GP Video] Stop recording error:', err);
    return NextResponse.json({ error: 'فشل في إيقاف التسجيل' }, { status: 500 });
  }
}
