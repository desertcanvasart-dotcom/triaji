import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@triaji/shared/supabase';
import { createDirectBooking, SlotNotFoundError, SlotTakenError } from '@/lib/booking/engine';
import { allowsSlotBooking, doctorBelongsToClinic, loadClinic } from '@/lib/clinic/public-clinic';
import { redis } from '@/lib/cache/redis';

export const dynamic = 'force-dynamic';

/**
 * POST /api/clinics/[tenantId]/book — book a slot from a clinic's public page.
 * Body: { slot_id, doctor_id, patient_name, patient_phone, locale? }.
 *
 * Public and unauthenticated like the triage booking flow, so it is throttled
 * per IP and per phone to keep a script from emptying a clinic's schedule.
 */

const PHONE_RE = /^(010|011|012|015)\d{8}$/;
const WINDOW_SECONDS = 10 * 60;
const MAX_PER_IP = 5;
const MAX_PER_PHONE = 3;

const T = {
  missing: { ar: 'اختار موعد واكتب اسمك ورقم موبايلك', en: 'Pick a slot and enter your name and mobile number' },
  phone: { ar: 'من فضلك أدخل رقم موبايل مصري صحيح', en: 'Please enter a valid Egyptian mobile number' },
  name: { ar: 'من فضلك أدخل اسمك بالكامل', en: 'Please enter your full name' },
  closed: { ar: 'العيادة دي مش بتستقبل حجوزات أونلاين', en: 'This clinic does not take online bookings' },
  doctor: { ar: 'الطبيب غير موجود في العيادة دي', en: 'That doctor is not at this clinic' },
  slot: { ar: 'الموعد ده مش متاح، اختار موعد تاني', en: 'That slot is not available — please pick another' },
  tooMany: { ar: 'محاولات كتير، استنى شوية وحاول تاني', en: 'Too many attempts — please wait a few minutes' },
  failed: { ar: 'حصل خطأ، حاول تاني', en: 'Something went wrong, please try again' },
} as const;

/** Fixed-window counter; returns false once `limit` is exceeded. */
async function withinLimit(key: string, limit: number): Promise<boolean> {
  const current = Number((await redis.get<string | number>(key)) ?? 0);
  if (current >= limit) return false;
  await redis.set(key, String(current + 1), { ex: WINDOW_SECONDS });
  return true;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  let locale: 'ar' | 'en' = 'ar';
  try {
    const { tenantId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    locale = body.locale === 'en' ? 'en' : 'ar';

    const slotId = typeof body.slot_id === 'string' ? body.slot_id : '';
    const doctorId = typeof body.doctor_id === 'string' ? body.doctor_id : '';
    const name = typeof body.patient_name === 'string' ? body.patient_name.trim() : '';
    const phone = typeof body.patient_phone === 'string' ? body.patient_phone.replace(/[\s\-()]/g, '') : '';

    if (!slotId || !doctorId || !name || !phone) {
      return NextResponse.json({ error: T.missing[locale] }, { status: 400 });
    }
    if (!PHONE_RE.test(phone)) {
      return NextResponse.json({ error: T.phone[locale] }, { status: 400 });
    }
    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ error: T.name[locale] }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (
      !(await withinLimit(`clinic-book:ip:${ip}`, MAX_PER_IP)) ||
      !(await withinLimit(`clinic-book:phone:${phone}`, MAX_PER_PHONE))
    ) {
      return NextResponse.json({ error: T.tooMany[locale] }, { status: 429 });
    }

    const supabase = createServerClient();

    const clinic = await loadClinic(supabase, tenantId);
    if (!clinic || !allowsSlotBooking(clinic.bookingMode)) {
      return NextResponse.json({ error: T.closed[locale] }, { status: 403 });
    }
    if (!(await doctorBelongsToClinic(supabase, tenantId, doctorId))) {
      return NextResponse.json({ error: T.doctor[locale] }, { status: 404 });
    }

    const { data: slot } = await supabase
      .from('doctor_availability')
      .select('id')
      .eq('id', slotId)
      .eq('doctor_id', doctorId)
      .maybeSingle();
    if (!slot) {
      return NextResponse.json({ error: T.slot[locale] }, { status: 404 });
    }

    const result = await createDirectBooking({
      tenantId,
      doctorId,
      slotId,
      patientName: name,
      phoneNumber: phone,
    });

    return NextResponse.json({ success: true, booking: result });
  } catch (err) {
    if (err instanceof SlotTakenError || err instanceof SlotNotFoundError) {
      return NextResponse.json({ error: T.slot[locale] }, { status: 409 });
    }
    console.error('[clinics/book] failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: T.failed[locale] }, { status: 500 });
  }
}
