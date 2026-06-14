import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPushNotification } from '@/lib/notifications/push';
import type { GpCallStatus } from '@triaji/shared/types/gp-video';

export const dynamic = 'force-dynamic';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ─── Valid Status Transitions ───────────────────────────────────────────────

const VALID_TRANSITIONS: Record<GpCallStatus, GpCallStatus[]> = {
  initiated: ['ringing', 'declined', 'missed'],
  ringing: ['accepted', 'declined', 'missed'],
  accepted: ['in_progress'],
  in_progress: ['completed'],
  declined: [],
  missed: [],
  completed: [],
  failed: [],
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface UpdateBody {
  status: GpCallStatus;
  endReason?: string;
  connectionQuality?: string;
}

interface CallRow {
  id: string;
  status: string;
  initiator: string;
  patient_id: string;
  doctor_id: string;
  doctor_account_id: string;
  livekit_room_name: string;
  initiated_at: string;
  is_recorded: boolean;
}

interface PatientRow {
  id: string;
  name_ar: string | null;
  expo_push_token: string | null;
}

interface DoctorAccountRow {
  id: string;
  name_ar: string;
  expo_push_token: string | null;
}

// ─── PUT /api/telehealth/gp-call/[id] ───────────────────────────────────────
// Update GP call status with validated transitions.

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateBody;

    if (!body.status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // ── Load current call ────────────────────────────────────────────────

    const { data: call } = await supabase
      .from('gp_video_calls')
      .select('id, status, initiator, patient_id, doctor_id, doctor_account_id, livekit_room_name, initiated_at, is_recorded')
      .eq('id', id)
      .single() as { data: CallRow | null };

    if (!call) {
      return NextResponse.json({ error: 'المكالمة غير موجودة' }, { status: 404 });
    }

    // ── Validate transition ──────────────────────────────────────────────

    const currentStatus = call.status as GpCallStatus;
    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];

    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        {
          error: `لا يمكن التحويل من "${currentStatus}" إلى "${body.status}"`,
          error_en: `Cannot transition from "${currentStatus}" to "${body.status}"`,
        },
        { status: 422 }
      );
    }

    // ── Build update payload ─────────────────────────────────────────────

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      status: body.status,
      updated_at: now,
    };

    if (body.endReason) {
      update.end_reason = body.endReason;
    }

    if (body.connectionQuality) {
      // Determine which quality field to update based on who is sending
      // For now, store as doctor_connection_quality (caller specifies via role context)
      update.doctor_connection_quality = body.connectionQuality;
    }

    // ── Status-specific updates ──────────────────────────────────────────

    switch (body.status) {
      case 'accepted':
        update.accepted_at = now;
        break;

      case 'completed': {
        update.ended_at = now;
        const initiatedAt = new Date(call.initiated_at).getTime();
        const duration = Math.floor((Date.now() - initiatedAt) / 1000);
        update.duration_seconds = duration;
        break;
      }

      case 'declined':
      case 'missed':
        update.ended_at = now;
        break;
    }

    // ── Persist update ───────────────────────────────────────────────────

    const { error: updateError } = await supabase
      .from('gp_video_calls')
      .update(update)
      .eq('id', id);

    if (updateError) {
      console.error('[GP Video] Failed to update call:', updateError);
      return NextResponse.json({ error: 'فشل في تحديث حالة المكالمة' }, { status: 500 });
    }

    // ── Post-status notifications ────────────────────────────────────────

    if (body.status === 'declined' || body.status === 'missed') {
      // Notify the initiator that the call was declined/missed
      const isInitiatorDoctor = call.initiator === 'doctor';

      if (isInitiatorDoctor) {
        const { data: doctor } = await supabase
          .from('doctor_accounts')
          .select('id, name_ar, expo_push_token')
          .eq('id', call.doctor_account_id)
          .single() as { data: DoctorAccountRow | null };

        if (doctor?.expo_push_token) {
          const title = body.status === 'declined' ? 'تم رفض المكالمة' : 'مكالمة فائتة';
          const msg = body.status === 'declined'
            ? 'المريض رفض المكالمة'
            : 'لم يرد المريض على المكالمة';
          await sendPushNotification(doctor.expo_push_token, title, msg, {
            type: `gp_call_${body.status}`,
            callId: id,
          });
        }
      } else {
        const { data: patient } = await supabase
          .from('patients')
          .select('id, name_ar, expo_push_token')
          .eq('id', call.patient_id)
          .single() as { data: PatientRow | null };

        if (patient?.expo_push_token) {
          const title = body.status === 'declined' ? 'تم رفض المكالمة' : 'مكالمة فائتة';
          const msg = body.status === 'declined'
            ? 'الطبيب رفض المكالمة'
            : 'لم يرد الطبيب على المكالمة';
          await sendPushNotification(patient.expo_push_token, title, msg, {
            type: `gp_call_${body.status}`,
            callId: id,
          });
        }
      }
    }

    // ── Trigger transcription on completion if recorded ───────────────────

    if (body.status === 'completed' && call.is_recorded) {
      // Fire-and-forget transcription trigger
      const baseUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';
      fetch(`${baseUrl}/api/telehealth/gp-transcribe/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '',
        },
      }).catch((err) => {
        console.error('[GP Video] Failed to trigger transcription:', err);
      });
    }

    return NextResponse.json({
      callId: id,
      status: body.status,
      updated: true,
    });
  } catch (err) {
    console.error('[GP Video] Call update error:', err);
    return NextResponse.json({ error: 'فشل في تحديث المكالمة' }, { status: 500 });
  }
}
