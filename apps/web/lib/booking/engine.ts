/**
 * Booking Engine
 *
 * Handles the full booking flow: validate → reserve → notify → confirm.
 * Supports three booking modes:
 *   - native:          Standard Triajji booking (default)
 *   - his_integration: Book via HIS API, store reference
 *   - hybrid:          Try HIS first, fall back to native on failure
 */

import { createServerClient } from '@triaji/shared/supabase';
import { sendWhatsAppMessage, maskPhone } from '@triaji/shared/lib/whatsapp/client';
import { sendSMS } from '@/lib/sms/client';
import {
  bookingConfirmationMessage,
  smsConfirmationMessage,
  type BookingTemplateData,
} from '@/lib/whatsapp/templates';
import type { ConfirmChannel } from '@triaji/shared/types';
import { getAdapter } from '@triaji/his-adapters';
import type { HisAdapterConfig } from '@triaji/his-adapters';
import { decryptCredentials } from '@/lib/his/crypto';
import { getChainForTenant, upsertChainPatient } from '@/lib/chain/patient-recognition';

type BookingMode = 'native' | 'his_integration' | 'hybrid';

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
  hisBookingRef?: string;
  bookingSource: 'native' | 'his_api';
}

export interface BookingPaymentPendingResult {
  bookingId: string;
  paymentReference: string;
  paymentUrl?: string | null;
  status: 'payment_pending';
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
 * Determine booking mode for a tenant.
 * Checks if tenant has active HIS integration.
 */
async function getTenantBookingMode(tenantId: string): Promise<BookingMode> {
  const supabase = createServerClient();

  const { data: integration } = await supabase
    .from('his_integrations')
    .select('id, vendor')
    .eq('tenant_id', tenantId)
    .eq('sync_enabled', true)
    .single();

  if (!integration) return 'native';

  // booking_mode is configured on tenant_config (not his_integrations).
  const { data: config } = await supabase
    .from('tenant_config')
    .select('booking_mode')
    .eq('tenant_id', tenantId)
    .single();

  const mode = (config?.booking_mode as string) ?? 'hybrid';
  if (mode === 'his_integration' || mode === 'hybrid') return mode;
  return 'native';
}

/**
 * Get HIS adapter for a tenant.
 */
async function getAdapterForTenant(tenantId: string) {
  const supabase = createServerClient();

  const { data: integration } = await supabase
    .from('his_integrations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('sync_enabled', true)
    .single();

  if (!integration) {
    throw new Error('No active HIS integration for this tenant');
  }

  const credentials = decryptCredentials(
    typeof integration.credentials_encrypted === 'string'
      ? integration.credentials_encrypted
      : JSON.stringify(integration.credentials_encrypted)
  );

  const adapterConfig: HisAdapterConfig = {
    vendor: integration.vendor as HisAdapterConfig['vendor'],
    baseUrl: integration.base_url as string,
    authType: integration.auth_type as HisAdapterConfig['authType'],
    credentials: credentials as HisAdapterConfig['credentials'],
    tenantId,
    fieldMapping: (credentials['field_mapping'] as Record<string, string>) ?? undefined,
  };

  return getAdapter(adapterConfig);
}

/**
 * Execute the full booking flow.
 * Determines booking mode and routes accordingly.
 */
export async function createBooking(input: BookingInput): Promise<BookingResult> {
  const supabase = createServerClient();

  // Get session to find patient_id and tenant_id
  const { data: session, error: sessionError } = await supabase
    .from('triage_sessions')
    .select('patient_id, tenant_id')
    .eq('id', input.sessionId)
    .single();

  if (sessionError || !session) {
    throw new Error('الجلسة غير موجودة.');
  }

  const tenantId = session.tenant_id as string | null;

  // Determine booking mode
  let bookingMode: BookingMode = 'native';
  if (tenantId) {
    bookingMode = await getTenantBookingMode(tenantId);
  }

  if (bookingMode === 'native') {
    return nativeBooking(input, session.patient_id as string);
  }

  if (bookingMode === 'his_integration') {
    return hisBooking(input, session.patient_id as string, tenantId as string);
  }

  // Hybrid: try HIS first, fall back to native
  try {
    return await hisBooking(input, session.patient_id as string, tenantId as string);
  } catch (err) {
    console.warn('[Booking] HIS booking failed, falling back to native:', err);
    return nativeBooking(input, session.patient_id as string);
  }
}

/**
 * Native booking flow — unchanged from Phase 6.
 */
async function nativeBooking(
  input: BookingInput,
  patientId: string
): Promise<BookingResult> {
  const supabase = createServerClient();

  // Atomic slot reservation via RPC
  const { data: rpcResult, error: rpcError } = await supabase.rpc('reserve_slot', {
    p_slot_id: input.slotId,
    p_patient_id: patientId,
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
  return finalizeBooking(input, bookingId, 'native');
}

/**
 * HIS booking flow — creates booking in external HIS system first,
 * then creates local booking record with HIS reference.
 */
async function hisBooking(
  input: BookingInput,
  patientId: string,
  tenantId: string
): Promise<BookingResult> {
  const supabase = createServerClient();

  // Get HIS adapter
  const adapter = await getAdapterForTenant(tenantId);

  // Get HIS slot ID from doctor_availability
  const { data: slot } = await supabase
    .from('doctor_availability')
    .select('his_slot_id')
    .eq('id', input.slotId)
    .single();

  if (!slot?.his_slot_id) {
    throw new Error('Slot has no HIS reference — cannot book via HIS');
  }

  // Get doctor's HIS ID
  const { data: doctor } = await supabase
    .from('doctors')
    .select('his_doctor_id')
    .eq('id', input.doctorId)
    .single();

  if (!doctor?.his_doctor_id) {
    throw new Error('Doctor has no HIS reference — cannot book via HIS');
  }

  // Create booking in HIS
  const hisResult = await adapter.createBooking({
    hisSlotId: slot.his_slot_id as string,
    hisDoctorId: doctor.his_doctor_id as string,
    patientNameAr: input.patientName,
    patientPhone: input.phoneNumber,
    notes: input.notes,
    triajiRef: crypto.randomUUID(),
  });

  if (!hisResult.success) {
    throw new Error(`HIS booking failed: ${hisResult.error ?? 'Unknown error'}`);
  }

  // Now do local reservation (same RPC)
  const { data: rpcResult, error: rpcError } = await supabase.rpc('reserve_slot', {
    p_slot_id: input.slotId,
    p_patient_id: patientId,
    p_doctor_id: input.doctorId,
    p_session_id: input.sessionId,
    p_patient_name: input.patientName,
    p_phone_number: input.phoneNumber,
    p_notes: input.notes ?? null,
  });

  if (rpcError) {
    // HIS booking succeeded but local failed — log but don't lose HIS ref
    console.error('[Booking] HIS succeeded but local reserve failed:', rpcError.message);
    throw new Error(`خطأ في الحجز المحلي: ${rpcError.message}`);
  }

  const reservation = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
  if (!reservation?.success) {
    const code = reservation?.error_code;
    if (code === 'SLOT_TAKEN') throw new SlotTakenError();
    if (code === 'SLOT_NOT_FOUND') throw new SlotNotFoundError();
    throw new Error('خطأ غير متوقع في الحجز.');
  }

  const bookingId = reservation.booking_id as string;

  // Store HIS booking ref on the booking record
  await supabase
    .from('bookings')
    .update({
      his_booking_ref: hisResult.hisBookingRef,
      booking_source: 'his_api',
    })
    .eq('id', bookingId);

  return finalizeBooking(input, bookingId, 'his_api', hisResult.hisBookingRef);
}

/**
 * Shared finalization: fetch details, send confirmation, update status.
 */
async function finalizeBooking(
  input: BookingInput,
  bookingId: string,
  source: 'native' | 'his_api',
  hisBookingRef?: string
): Promise<BookingResult> {
  const supabase = createServerClient();

  // Fetch doctor + booking details for confirmation
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

  // Send confirmation — WhatsApp first, SMS fallback
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

  // Update booking status to confirmed
  await supabase
    .from('bookings')
    .update({
      status: 'confirmed',
      confirmation_sent_at: new Date().toISOString(),
      confirmation_channel: confirmationChannel,
    })
    .eq('id', bookingId);

  // ─── Chain Patient Registry (non-blocking side effect) ──────────────────
  // AMENDMENT: Triggered ONLY on status → 'confirmed'
  {
    const { data: bookingRow } = await supabase
      .from('bookings')
      .select('patient_id, tenant_id')
      .eq('id', bookingId)
      .single();

    if (bookingRow?.tenant_id) {
      getChainForTenant(bookingRow.tenant_id as string)
        .then((chain) => {
          if (chain) {
            return upsertChainPatient(
              chain.chainId,
              bookingRow.patient_id as string,
              bookingRow.tenant_id as string
            );
          }
        })
        .catch((err) => {
          console.warn('[Booking] Chain patient upsert failed (non-blocking):', err);
        });
    }
  }

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
    hisBookingRef,
    bookingSource: source,
  };
}

// ─── Payment-Pending Booking Flow ─────────────────────────────────────────────
//
// Creates a booking with status='payment_pending', then initiates a payment
// transaction. The booking is confirmed only after the payment webhook fires.
// No confirmation WhatsApp is sent at this stage.

export async function createBookingPaymentPending(
  input: BookingInput,
): Promise<BookingPaymentPendingResult> {
  const supabase = createServerClient();

  // 1. Get session to find patient_id
  const { data: session, error: sessionError } = await supabase
    .from('triage_sessions')
    .select('patient_id, tenant_id')
    .eq('id', input.sessionId)
    .single();

  if (sessionError || !session) {
    throw new Error('الجلسة غير موجودة.');
  }

  const patientId = session.patient_id as string;

  // 2. Reserve the slot atomically
  const { data: rpcResult, error: rpcError } = await supabase.rpc('reserve_slot', {
    p_slot_id: input.slotId,
    p_patient_id: patientId,
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

  // 3. Set booking status to payment_pending (not confirmed yet)
  await supabase
    .from('bookings')
    .update({ status: 'payment_pending' })
    .eq('id', bookingId);

  // 4. Get fee from doctor record
  const { data: doctor } = await supabase
    .from('doctors')
    .select('consultation_fee_egp, tenant_id')
    .eq('id', input.doctorId)
    .single();

  const fee = (doctor?.consultation_fee_egp as number) ?? 0;
  const tenantId = (doctor?.tenant_id as string) ?? (session.tenant_id as string);

  // 5. Determine preferred payment provider from tenant config
  const { data: tenantConfig } = await supabase
    .from('tenant_config')
    .select('accepts_online_payment, payment_providers')
    .eq('tenant_id', tenantId)
    .single();

  // Pick first enabled provider, defaulting to fawry
  let provider = 'fawry';
  if (tenantConfig?.payment_providers) {
    const providers = tenantConfig.payment_providers as string[];
    if (providers.length > 0) {
      provider = providers[0]!;
    }
  }

  // 6. Initiate payment transaction via internal call
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://triajji.com';
  const paymentRes = await fetch(`${baseUrl}/api/payments/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payable_type: 'booking',
      payable_id: bookingId,
      provider,
      amount_egp: fee,
    }),
  });

  if (!paymentRes.ok) {
    // Payment initiation failed — still return booking but without payment
    console.error('[createBookingPaymentPending] Payment initiation failed');
    // Revert to confirmed status so booking is not stuck
    await supabase
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', bookingId);

    return {
      bookingId,
      paymentReference: '',
      status: 'payment_pending',
    };
  }

  const paymentData = await paymentRes.json();

  return {
    bookingId,
    paymentReference: paymentData.reference as string,
    paymentUrl: paymentData.paymentUrl ?? null,
    status: 'payment_pending',
  };
}
