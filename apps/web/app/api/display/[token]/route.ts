import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { verifyDisplayToken } from '@/lib/display-token';

export const dynamic = 'force-dynamic';

/**
 * GET /api/display/[token] — what a waiting-room TV shows for one doctor:
 * the number being served, the next few in line and how many are waiting.
 *
 * Public (the token is the credential), so it returns only queue numbers and a
 * shortened first name — never phones, complaints or full names.
 */

const UP_NEXT = 4;

/** Today's calendar date in Egypt — the same day boundary as the doctor's work-day screen. */
function cairoToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** "أحمد محمود علي" → "أحمد م." */
function shortName(full: string | null): string {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return parts.length > 1 ? `${parts[0]} ${Array.from(parts[1]!)[0]}.` : parts[0]!;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const doctorId = verifyDisplayToken(token);
  if (!doctorId) {
    return NextResponse.json({ error: 'invalid_link' }, { status: 404 });
  }

  const supabase = createServerClient();
  const day = cairoToday();

  const [doctorRes, queueRes] = await Promise.all([
    supabase.from('doctors').select('name_ar, name_en, title_ar, tenant_id').eq('id', doctorId).maybeSingle(),
    supabase
      .from('clinic_queue')
      .select('queue_number, status, patient_name_ar, called_at')
      .eq('doctor_id', doctorId)
      .eq('queue_date', day)
      .in('status', ['waiting', 'called'])
      .order('queue_number', { ascending: true }),
  ]);

  if (!doctorRes.data) {
    return NextResponse.json({ error: 'invalid_link' }, { status: 404 });
  }
  if (queueRes.error) {
    console.error('[display] queue load failed:', queueRes.error.message);
    return NextResponse.json({ error: 'unavailable' }, { status: 500 });
  }

  const doctor = doctorRes.data;
  let clinicName: { ar: string | null; en: string | null } = { ar: null, en: null };
  if (doctor.tenant_id) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name_ar, name_en')
      .eq('id', doctor.tenant_id)
      .maybeSingle();
    clinicName = { ar: (tenant?.name_ar as string | null) ?? null, en: (tenant?.name_en as string | null) ?? null };
  }

  const rows = (queueRes.data ?? []) as {
    queue_number: number;
    status: 'waiting' | 'called';
    patient_name_ar: string | null;
    called_at: string | null;
  }[];

  // The most recently called patient is the one in the room.
  const called = rows
    .filter((r) => r.status === 'called')
    .sort((a, b) => (b.called_at ?? '').localeCompare(a.called_at ?? ''))[0];
  const waiting = rows.filter((r) => r.status === 'waiting');

  return NextResponse.json(
    {
      doctor: {
        name_ar: doctor.name_ar,
        name_en: doctor.name_en,
        title_ar: doctor.title_ar,
      },
      clinic: clinicName,
      now_serving: called ? { number: called.queue_number, name: shortName(called.patient_name_ar) } : null,
      up_next: waiting.slice(0, UP_NEXT).map((r) => ({ number: r.queue_number, name: shortName(r.patient_name_ar) })),
      waiting_count: waiting.length,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
