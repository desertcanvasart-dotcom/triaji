/**
 * Lab Chain Notifications (Bilingual AR/EN)
 *
 * WhatsApp notifications for chain API fallbacks, booking confirmations,
 * and result-ready alerts.
 */

import { createServerClient } from '@triaji/shared/supabase';
import { sendWhatsAppMessage, type WhatsAppResult } from '@/lib/whatsapp/client';
import type { Lang } from '@triaji/shared/i18n/strings';
import type { LabChainCode } from '@triaji/lab-chain-adapters';

// ─── Helpers ────────────────────────────────────────────────────────────────────

const CHAIN_NAMES: Record<LabChainCode, { ar: string; en: string }> = {
  alborg: { ar: 'البرج', en: 'Al-Borg' },
  almokhtabar: { ar: 'المختبر', en: 'Al-Mokhtabar' },
  alfa: { ar: 'ألفا', en: 'Alfa Lab' },
};

function chainName(code: LabChainCode, lang: Lang): string {
  return CHAIN_NAMES[code]?.[lang] ?? code;
}

function formatDate(date: Date | string, lang: Lang): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Doctor: API Fallback ───────────────────────────────────────────────────────

/**
 * Notify the referring doctor that chain API submission failed
 * and the order is proceeding manually.
 */
export async function notifyDoctorApiFallback(
  routingId: string,
  chainCode: LabChainCode,
): Promise<WhatsAppResult | null> {
  const supabase = createServerClient();

  // Find the doctor via routing → health_record → booking → doctor
  const { data: routing } = await supabase
    .from('lab_order_routing')
    .select(`
      health_record_id,
      health_record:health_records!lab_order_routing_health_record_id_fkey (
        patient_id,
        booking_id
      )
    `)
    .eq('id', routingId)
    .single();

  if (!routing) return null;

  const hr = routing.health_record as unknown as Record<string, string> | null;
  if (!hr?.booking_id) return null;

  const { data: booking } = await supabase
    .from('bookings')
    .select('doctor_id')
    .eq('id', hr.booking_id)
    .single();

  if (!booking?.doctor_id) return null;

  // doctors has no phone/preferred_language; the contactable number is on
  // doctor_accounts (keyed by doctor_id). No doctor language pref exists → default 'ar'.
  const { data: account } = await supabase
    .from('doctor_accounts')
    .select('phone')
    .eq('doctor_id', booking.doctor_id)
    .maybeSingle();

  const doctorPhone = (account?.phone as string | null) ?? null;
  if (!doctorPhone) return null;

  const lang: Lang = 'ar';
  const chain = chainName(chainCode, lang);

  const message =
    lang === 'ar'
      ? `تنبيه من دكتور تريو:\nلم نتمكن من إرسال طلب التحاليل إلى ${chain} عبر النظام الإلكتروني.\nالطلب يتم إرساله يدوياً الآن.\nرقم التوجيه: ${routingId}`
      : `DoctorTrio Alert:\nCould not send order to ${chain} via API. Proceeding manually.\nRouting ID: ${routingId}`;

  return sendWhatsAppMessage(doctorPhone, message);
}

// ─── Patient: Chain Booking Confirmation ────────────────────────────────────────

export interface ChainBookingData {
  chainCode: LabChainCode;
  confirmationCode: string;
  branchName?: string;
  date: string;
  time?: string;
  homeCollection?: boolean;
  testNames?: string[];
}

/**
 * Notify patient about a confirmed chain lab booking.
 */
export async function notifyPatientChainBooking(
  phone: string,
  lang: Lang,
  data: ChainBookingData,
): Promise<WhatsAppResult> {
  const chain = chainName(data.chainCode, lang);
  const dateStr = formatDate(data.date, lang);
  const testsLine = data.testNames?.length
    ? (lang === 'ar'
      ? `التحاليل: ${data.testNames.join('، ')}`
      : `Tests: ${data.testNames.join(', ')}`)
    : '';

  const locationLine = data.homeCollection
    ? (lang === 'ar' ? 'السحب من المنزل' : 'Home collection')
    : (data.branchName ?? '');

  const message =
    lang === 'ar'
      ? `تأكيد حجز تحاليل - ${chain}\n\nرقم التأكيد: ${data.confirmationCode}\nالتاريخ: ${dateStr}${data.time ? `\nالوقت: ${data.time}` : ''}\nالمكان: ${locationLine}${testsLine ? `\n${testsLine}` : ''}\n\nدكتور تريو`
      : `Lab Booking Confirmed - ${chain}\n\nConfirmation: ${data.confirmationCode}\nDate: ${dateStr}${data.time ? `\nTime: ${data.time}` : ''}\nLocation: ${locationLine}${testsLine ? `\n${testsLine}` : ''}\n\nDoctorTrio`;

  return sendWhatsAppMessage(phone, message);
}

// ─── Patient: Chain Results Ready ───────────────────────────────────────────────

export interface ChainResultsData {
  chainCode: LabChainCode;
  testCount: number;
  abnormalCount: number;
  summaryAr?: string;
  summaryEn?: string;
  viewUrl?: string;
}

/**
 * Notify patient that lab chain results are ready.
 */
export async function notifyPatientChainResults(
  phone: string,
  lang: Lang,
  data: ChainResultsData,
): Promise<WhatsAppResult> {
  const chain = chainName(data.chainCode, lang);

  let message: string;

  if (lang === 'ar') {
    message = `نتائج التحاليل جاهزة - ${chain}\n\nعدد التحاليل: ${data.testCount}`;

    if (data.abnormalCount > 0) {
      message += `\nتحاليل خارج المعدل الطبيعي: ${data.abnormalCount}`;
    }

    if (data.summaryAr) {
      message += `\n\n${data.summaryAr}`;
    }

    if (data.viewUrl) {
      message += `\n\nعرض النتائج:\n${data.viewUrl}`;
    }

    message += '\n\nدكتور تريو';
  } else {
    message = `Lab Results Ready - ${chain}\n\nTests completed: ${data.testCount}`;

    if (data.abnormalCount > 0) {
      message += `\nAbnormal results: ${data.abnormalCount}`;
    }

    if (data.summaryEn) {
      message += `\n\n${data.summaryEn}`;
    }

    if (data.viewUrl) {
      message += `\n\nView results:\n${data.viewUrl}`;
    }

    message += '\n\nDoctorTrio';
  }

  return sendWhatsAppMessage(phone, message);
}

// ─── Doctor: Results Ready ──────────────────────────────────────────────────────

/**
 * Notify the referring doctor that chain lab results are ready.
 */
export async function notifyDoctorChainResults(
  doctorPhone: string,
  lang: Lang,
  data: {
    patientName: string;
    chainCode: LabChainCode;
    testCount: number;
    abnormalCount: number;
    routingId: string;
  },
): Promise<WhatsAppResult> {
  const chain = chainName(data.chainCode, lang);

  const message =
    lang === 'ar'
      ? `دكتور تريو — نتائج تحاليل جاهزة\n\nالمريض: ${data.patientName}\nالمعمل: ${chain}\nعدد التحاليل: ${data.testCount}${data.abnormalCount > 0 ? `\nنتائج غير طبيعية: ${data.abnormalCount}` : ''}\nرقم التوجيه: ${data.routingId}`
      : `DoctorTrio — Lab Results Ready\n\nPatient: ${data.patientName}\nLab: ${chain}\nTests: ${data.testCount}${data.abnormalCount > 0 ? `\nAbnormal: ${data.abnormalCount}` : ''}\nRouting ID: ${data.routingId}`;

  return sendWhatsAppMessage(doctorPhone, message);
}
