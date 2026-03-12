/**
 * Booking Engine
 * Handles the full booking flow: validate → reserve → notify → confirm.
 */

import { createServerClient } from '@triaji/shared/supabase';
import { sendWhatsAppMessage, maskPhone } from '@/lib/whatsapp/client';
import { sendSMS } from '@/lib/sms/client';
import {
  bookingConfirmationMessage,
  smsConfirmationMessage,
  type BookingTemplateData,
} from '@/lib/whatsapp/templates';
import type { ConfirmChannel } from '@triaji/shared/types';

const ARABIC_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] as const;
const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
] as const;

function formatTimeAr(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const isPM = hours >= 12;
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const minuteStr = minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : ':00';
  return `${displayHour}${minuteStr} ${isPM ? 'مساءً' : 'صباحاً'}`;
}

export interface BookingInput {
  sessionId: string;
  doctorId: string;
  slotId: string;
  patientName: string;
  phoneNumber: string;
  notes?: string;
}

export interface BookingResult {
  bookingId: string;
  appointmentDatetime: string;
  doctorNameAr: string;
  specialtyNameAr: string;
  clinicAddressAr: string | null;
  consultationFeeEgp: number | null;
  confirmationSentTo: string;
  confirmationChannel: ConfirmChannel | null;
  status: 'confirmed';
  dateAr: string;
  timeAr: string;
}

export class SlotTakenError extends Error {
  constructor() {
    super('عذراً، هذا الميعاد تم حجزه للتو. من فضلك اختر ميعاد آخر.');
    this.name = 'SlotTakenError';
  }
}

export class SlotNotFoundError extends Error {
  constructor() {
    super('الميعاد المطلوب غير موجود.');
    this.name = 'SlotNotFoundError';
  }
}

/**
 * Execute the full booking flow.
 */
export async function createBooking(input: BookingInput): Promise<BookingResult> {
  const supabase = createServerClient();

  // 1. Get session to find patient_id
  const { data: session, error: sessionError } = await supabase
    .from('triage_sessions')
    .select('patient_id')
    .eq('id', input.sessionId)
    .single();

  if (sessionError || !session) {
    throw new Error('الجلسة غير موجودة.');
  }

  // 2. Atomic slot reservation via RPC
  const { data: rpcResult, error: rpcError } = await supabase.rpc('reserve_slot', {
    p_slot_id: input.slotId,
    p_patient_id: session.patient_id as string,
    p_doctor_id: input.doctorId,
    p_session_id: input.sessionId,
    p_patient_name: input.patientName,
    p_phone_number: input.phoneNumber,
    p_notes: input.notes ?? null,
  });

  if (rpcError) {
    throw new Error(`خطأ في الحجز: ${rpcError.message}`);
  }

  const reservation = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
  if (!reservation?.success) {
    const code = reservation?.error_code;
    if (code === 'SLOT_TAKEN') throw new SlotTakenError();
    if (code === 'SLOT_NOT_FOUND') throw new SlotNotFoundError();
    throw new Error('خطأ غير متوقع في الحجز.');
  }

  const bookingId = reservation.booking_id as string;

  // 3. Fetch doctor + booking details for confirmation
  const { data: doctor } = await supabase
    .from('doctors')
    .select('name_ar, title_ar, clinic_address_ar, consultation_fee_egp, specialty_id')
    .eq('id', input.doctorId)
    .single();

  const { data: booking } = await supabase
    .from('bookings')
    .select('appointment_datetime')
    .eq('id', bookingId)
    .single();

  const { data: specialty } = await supabase
    .from('specialties')
    .select('name_ar')
    .eq('id', doctor?.specialty_id ?? '')
    .single();

  const appointmentDt = new Date(booking?.appointment_datetime as string);
  const dayAr = ARABIC_DAYS[appointmentDt.getDay()] ?? '';
  const dateAr = `${dayAr} ${appointmentDt.getDate()} ${ARABIC_MONTHS[appointmentDt.getMonth()] ?? ''}`;
  const timeAr = formatTimeAr(appointmentDt);

  // 4. Send confirmation — WhatsApp first, SMS fallback
  const templateData: BookingTemplateData = {
    patientName: input.patientName,
    doctorTitle: (doctor?.title_ar as string) ?? '',
    doctorName: (doctor?.name_ar as string) ?? '',
    specialtyName: (specialty?.name_ar as string) ?? '',
    dateAr,
    timeAr,
    clinicAddress: (doctor?.clinic_address_ar as string) ?? 'غير محدد',
    fee: (doctor?.consultation_fee_egp as number) ?? 0,
  };

  let confirmationChannel: ConfirmChannel | null = null;

  const whatsappResult = await sendWhatsAppMessage(
    input.phoneNumber,
    bookingConfirmationMessage(templateData)
  );

  if (whatsappResult.success) {
    confirmationChannel = 'whatsapp';
  } else {
    console.warn('[Booking] WhatsApp failed, trying SMS:', whatsappResult.error);
    const smsResult = await sendSMS(
      input.phoneNumber,
      smsConfirmationMessage(templateData)
    );
    confirmationChannel = smsResult.success ? 'sms' : null;
    if (!smsResult.success) {
      console.error('[Booking] SMS also failed:', smsResult.error);
    }
  }

  // 5. Update booking status to confirmed
  await supabase
    .from('bookings')
    .update({
      status: 'confirmed',
      confirmation_sent_at: new Date().toISOString(),
      confirmation_channel: confirmationChannel,
    })
    .eq('id', bookingId);

  // 6. Return result
  return {
    bookingId,
    appointmentDatetime: booking?.appointment_datetime as string,
    doctorNameAr: (doctor?.name_ar as string) ?? '',
    specialtyNameAr: (specialty?.name_ar as string) ?? '',
    clinicAddressAr: (doctor?.clinic_address_ar as string) ?? null,
    consultationFeeEgp: (doctor?.consultation_fee_egp as number) ?? null,
    confirmationSentTo: maskPhone(input.phoneNumber),
    confirmationChannel,
    status: 'confirmed',
    dateAr,
    timeAr,
  };
}
