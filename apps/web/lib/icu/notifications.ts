/**
 * ICU Transfer WhatsApp Notification Functions
 *
 * Bilingual (Arabic/English) notification templates for ICU transfer events.
 * Uses sendWhatsAppMessage from the WhatsApp client.
 */

import { sendWhatsAppMessage, type WhatsAppResult } from '@/lib/whatsapp/client';

// ─── Transfer Request Notification (to receiving hospital) ──────────────────

interface TransferRequestData {
  doctorName: string;
  patientName: string;
  patientAge?: number;
  diagnosis: string;
  summary: string;
  urgency: 'urgent' | 'emergency';
  currentLocation: string;
  etaMinutes?: number;
}

export async function sendTransferRequestNotification(
  hospitalPhone: string,
  lang: string,
  data: TransferRequestData
): Promise<WhatsAppResult> {
  const urgencyText =
    lang === 'en'
      ? data.urgency === 'emergency'
        ? 'Emergency'
        : 'Urgent'
      : data.urgency === 'emergency'
        ? 'طارئ جداً'
        : 'عاجل';

  const ageStr = data.patientAge
    ? lang === 'en'
      ? ` — ${data.patientAge} y/o`
      : ` — ${data.patientAge} سنة`
    : '';

  const etaStr = data.etaMinutes
    ? lang === 'en'
      ? `ETA: ${data.etaMinutes} minutes`
      : `الوقت المقدر للوصول: ${data.etaMinutes} دقيقة`
    : '';

  const message =
    lang === 'en'
      ? [
          `🚨 New ICU Transfer Request`,
          ``,
          `From: Dr. ${data.doctorName}`,
          `Patient: ${data.patientName}${ageStr}`,
          `Diagnosis: ${data.diagnosis}`,
          `Summary: ${data.summary}`,
          `Urgency: ${urgencyText}`,
          `Current location: ${data.currentLocation}`,
          etaStr,
          ``,
          `Please respond promptly.`,
          `Triajji Healthcare`,
        ]
          .filter(Boolean)
          .join('\n')
      : [
          `🚨 طلب تحويل جديد — عناية مركزة`,
          ``,
          `من: د. ${data.doctorName}`,
          `المريض: ${data.patientName}${ageStr}`,
          `التشخيص: ${data.diagnosis}`,
          `ملخص الحالة: ${data.summary}`,
          `الاستعجال: ${urgencyText}`,
          `الموقع الحالي: ${data.currentLocation}`,
          etaStr,
          ``,
          `يرجى الرد في أقرب وقت.`,
          `ترياچي للرعاية الصحية`,
        ]
          .filter(Boolean)
          .join('\n');

  return sendWhatsAppMessage(hospitalPhone, message);
}

// ─── Transfer Accepted Notification (to requesting doctor) ──────────────────

interface TransferAcceptedData {
  hospitalName: string;
  unitName: string;
  bedAssigned: string;
  contactPhone: string;
}

export async function sendTransferAcceptedNotification(
  doctorPhone: string,
  lang: string,
  data: TransferAcceptedData
): Promise<WhatsAppResult> {
  const message =
    lang === 'en'
      ? [
          `✅ Transfer accepted`,
          ``,
          `Hospital: ${data.hospitalName}`,
          `Unit: ${data.unitName}`,
          `Bed: ${data.bedAssigned}`,
          `Contact: ${data.contactPhone}`,
          ``,
          `Head to the hospital now.`,
          `Triajji Healthcare`,
        ].join('\n')
      : [
          `✅ تم قبول التحويل`,
          ``,
          `المستشفى: ${data.hospitalName}`,
          `الوحدة: ${data.unitName}`,
          `السرير: ${data.bedAssigned}`,
          `للتواصل: ${data.contactPhone}`,
          ``,
          `توجّه للمستشفى الآن.`,
          `ترياچي للرعاية الصحية`,
        ].join('\n');

  return sendWhatsAppMessage(doctorPhone, message);
}

// ─── Transfer Declined Notification (to requesting doctor) ──────────────────

interface TransferDeclinedData {
  hospitalName: string;
  reason: string;
}

export async function sendTransferDeclinedNotification(
  doctorPhone: string,
  lang: string,
  data: TransferDeclinedData
): Promise<WhatsAppResult> {
  const message =
    lang === 'en'
      ? [
          `❌ Transfer declined`,
          ``,
          `Hospital: ${data.hospitalName}`,
          `Reason: ${data.reason}`,
          ``,
          `Search for other hospitals.`,
          `Triajji Healthcare`,
        ].join('\n')
      : [
          `❌ تم رفض التحويل`,
          ``,
          `المستشفى: ${data.hospitalName}`,
          `السبب: ${data.reason}`,
          ``,
          `ابحث عن مستشفيات أخرى.`,
          `ترياچي للرعاية الصحية`,
        ].join('\n');

  return sendWhatsAppMessage(doctorPhone, message);
}

// ─── Transfer Status Notification (to receiving hospital) ───────────────────

interface TransferStatusData {
  status: 'en_route' | 'arrived';
  patientName: string;
}

export async function sendTransferStatusNotification(
  hospitalPhone: string,
  lang: string,
  data: TransferStatusData
): Promise<WhatsAppResult> {
  const statusText =
    data.status === 'en_route'
      ? lang === 'en'
        ? 'Patient en route'
        : 'المريض في الطريق'
      : lang === 'en'
        ? 'Patient arrived'
        : 'المريض وصل';

  const message =
    lang === 'en'
      ? [
          `🚑 ${statusText}`,
          ``,
          `Patient: ${data.patientName}`,
          ``,
          `Triajji Healthcare`,
        ].join('\n')
      : [
          `🚑 ${statusText}`,
          ``,
          `المريض: ${data.patientName}`,
          ``,
          `ترياچي للرعاية الصحية`,
        ].join('\n');

  return sendWhatsAppMessage(hospitalPhone, message);
}
