import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPushNotification } from '@/lib/notifications/push';

export const dynamic = 'force-dynamic';

// ─── Helpers ────────────────────────────────────────────────────────────────

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

interface CreateRoomBody {
  gpRelationshipId: string;
  initiator: 'doctor' | 'patient';
}

interface GpRelationship {
  id: string;
  patient_id: string;
  doctor_id: string;
  doctor_account_id: string;
  status: string;
}

interface PatientRow {
  id: string;
  name_ar: string | null;
  expo_push_token: string | null;
}

interface DoctorAccountRow {
  id: string;
  name_ar: string;
  doctor_id: string;
  expo_push_token: string | null;
  gp_video_call_fee_egp: number | null;
  gp_video_calls_enabled: boolean;
}

// ─── POST /api/telehealth/gp-room ───────────────────────────────────────────
// Create a LiveKit room for a GP video call.

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateRoomBody;

    if (!body.gpRelationshipId || !body.initiator) {
      return NextResponse.json(
        { error: 'gpRelationshipId and initiator are required' },
        { status: 400 }
      );
    }

    if (!['doctor', 'patient'].includes(body.initiator)) {
      return NextResponse.json(
        { error: 'initiator must be "doctor" or "patient"' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // ── Validate active GP relationship ──────────────────────────────────

    const { data: gpRel } = await supabase
      .from('gp_relationships')
      .select('id, patient_id, doctor_id, doctor_account_id, status')
      .eq('id', body.gpRelationshipId)
      .eq('status', 'active')
      .maybeSingle() as { data: GpRelationship | null };

    if (!gpRel) {
      return NextResponse.json(
        { error: 'علاقة طبيب عام غير موجودة أو غير نشطة' },
        { status: 404 }
      );
    }

    // ── Load doctor account settings ─────────────────────────────────────

    const { data: doctorAccount } = await supabase
      .from('doctor_accounts')
      .select('id, name_ar, doctor_id, expo_push_token, gp_video_call_fee_egp, gp_video_calls_enabled')
      .eq('id', gpRel.doctor_account_id)
      .single() as { data: DoctorAccountRow | null };

    if (!doctorAccount) {
      return NextResponse.json({ error: 'حساب الطبيب غير موجود' }, { status: 404 });
    }

    if (!doctorAccount.gp_video_calls_enabled) {
      return NextResponse.json(
        { error: 'مكالمات الفيديو غير متاحة لهذا الطبيب' },
        { status: 403 }
      );
    }

    // ── Check payment if patient-initiated and fee > 0 ───────────────────

    const fee = Number(doctorAccount.gp_video_call_fee_egp ?? 0);
    if (body.initiator === 'patient' && fee > 0) {
      // For now, return fee info — payment must be completed before call
      return NextResponse.json(
        {
          requiresPayment: true,
          fee,
          currency: 'EGP',
          doctorName: doctorAccount.name_ar,
          message: `رسوم المكالمة ${fee} جنيه — يرجى الدفع أولاً`,
        },
        { status: 402 }
      );
    }

    // ── Load patient ─────────────────────────────────────────────────────

    const { data: patient } = await supabase
      .from('patients')
      .select('id, name_ar, expo_push_token')
      .eq('id', gpRel.patient_id)
      .single() as { data: PatientRow | null };

    if (!patient) {
      return NextResponse.json({ error: 'المريض غير موجود' }, { status: 404 });
    }

    // ── Create room name ─────────────────────────────────────────────────

    const timestamp = Date.now();
    const roomName = `gp-${gpRel.doctor_id}-${gpRel.patient_id}-${timestamp}`;

    // ── Create LiveKit room ──────────────────────────────────────────────

    let roomSid: string | null = null;

    if (isLiveKitConfigured()) {
      try {
        const { RoomServiceClient } = await import('livekit-server-sdk');
        const roomService = new RoomServiceClient(
          LIVEKIT_URL!,
          LIVEKIT_API_KEY!,
          LIVEKIT_API_SECRET!
        );

        const room = await roomService.createRoom({
          name: roomName,
          emptyTimeout: 10 * 60,
          maxParticipants: 2,
        });

        roomSid = room.sid ?? null;
      } catch (err) {
        console.error('[GP Video] Failed to create LiveKit room:', err);
        // Continue with record creation — DEV fallback
      }
    } else {
      console.log('[GP Video DEV_MODE] Would create room:', roomName);
    }

    // ── Create gp_video_calls record ─────────────────────────────────────

    const { data: call, error: insertError } = await supabase
      .from('gp_video_calls')
      .insert({
        gp_relationship_id: gpRel.id,
        patient_id: gpRel.patient_id,
        doctor_id: gpRel.doctor_id,
        doctor_account_id: gpRel.doctor_account_id,
        livekit_room_name: roomName,
        livekit_room_sid: roomSid,
        initiator: body.initiator,
        status: 'initiated',
        call_fee_egp: fee,
        is_paid: fee === 0,
      })
      .select('id')
      .single();

    if (insertError || !call) {
      console.error('[GP Video] Failed to create call record:', insertError);
      return NextResponse.json({ error: 'فشل في إنشاء سجل المكالمة' }, { status: 500 });
    }

    // ── Send push notification to the other party ────────────────────────

    const isInitiatorDoctor = body.initiator === 'doctor';
    const targetToken = isInitiatorDoctor ? patient.expo_push_token : doctorAccount.expo_push_token;
    const callerName = isInitiatorDoctor ? doctorAccount.name_ar : (patient.name_ar ?? 'مريض');

    const pushTitle = isInitiatorDoctor
      ? 'مكالمة فيديو من طبيبك'
      : 'مكالمة فيديو من مريضك';
    const pushBody = isInitiatorDoctor
      ? `د. ${callerName} يتصل بك الآن`
      : `${callerName} يتصل بك الآن`;

    const pushSent = await sendPushNotification(
      targetToken,
      pushTitle,
      pushBody,
      {
        type: 'gp_video_call_incoming',
        callId: call.id,
        roomName,
        callerName,
        initiator: body.initiator,
      }
    );

    // ── AMENDMENT: If push fails, mark call as missed ────────────────────

    if (!pushSent) {
      await supabase
        .from('gp_video_calls')
        .update({ status: 'missed', ended_at: new Date().toISOString() })
        .eq('id', call.id);

      return NextResponse.json(
        {
          error: 'تعذر الوصول للمريض — قد يكون غير متصل',
          error_en: 'Could not reach patient — they may be offline',
          callId: call.id,
          status: 'missed',
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      callId: call.id,
      roomName,
      roomSid,
      serverUrl: LIVEKIT_URL ?? '',
      status: 'initiated',
    });
  } catch (err) {
    console.error('[GP Video] Room creation error:', err);
    return NextResponse.json({ error: 'فشل في إنشاء غرفة المكالمة' }, { status: 500 });
  }
}
