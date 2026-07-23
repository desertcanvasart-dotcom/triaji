/**
 * GP Relationship WhatsApp Notification Functions
 *
 * Bilingual (Arabic/English) notification templates for GP relationship events.
 * Uses sendWhatsAppMessage from the WhatsApp client.
 */

import { sendWhatsAppMessage, type WhatsAppResult } from '@/lib/whatsapp/client';

// ─── Notification: GP Request ────────────────────────────────────────────────
// Sent to the other party when a GP relationship is requested.

interface GPRequestData {
  requesterName: string;
  initiatedBy: 'patient' | 'doctor';
  confirmUrl: string;
}

export async function sendGPRequestNotification(
  phone: string,
  preferredLang: string,
  data: GPRequestData
): Promise<WhatsAppResult> {
  const message =
    data.initiatedBy === 'doctor'
      ? preferredLang === 'en'
        ? [
            `Dr. ${data.requesterName} wants to be your primary care doctor (GP).`,
            ``,
            `To accept or decline, click the link below:`,
            data.confirmUrl,
            ``,
            `DoctorTrio Healthcare`,
          ].join('\n')
        : [
            `الدكتور ${data.requesterName} يريد أن يكون طبيبك العام.`,
            ``,
            `للقبول أو الرفض، اضغط على الرابط:`,
            data.confirmUrl,
            ``,
            `دكتور تريو للرعاية الصحية`,
          ].join('\n')
      : // initiated by patient → notify the doctor (always Arabic)
        [
          `المريض ${data.requesterName} يطلب أن تكون طبيبه العام.`,
          ``,
          `للقبول أو الرفض، اضغط على الرابط:`,
          data.confirmUrl,
          ``,
          `دكتور تريو للرعاية الصحية`,
        ].join('\n');

  return sendWhatsAppMessage(phone, message);
}

// ─── Notification: GP Accepted ───────────────────────────────────────────────
// Sent to both parties when the GP relationship is confirmed.

interface GPAcceptedData {
  doctorName: string;
  patientName: string;
}

export async function sendGPAcceptedNotification(
  phone: string,
  preferredLang: string,
  data: GPAcceptedData
): Promise<WhatsAppResult> {
  const message =
    preferredLang === 'en'
      ? [
          `Your GP relationship with Dr. ${data.doctorName} has been confirmed.`,
          ``,
          `Dr. ${data.doctorName} will now be notified about your lab results, prescriptions, and specialist visits.`,
          ``,
          `DoctorTrio Healthcare`,
        ].join('\n')
      : [
          `تم تأكيد علاقة الطبيب العام مع الدكتور ${data.doctorName}.`,
          ``,
          `سيتم إبلاغ الدكتور ${data.doctorName} بنتائج تحاليلك ووصفاتك الطبية وزياراتك للأخصائيين.`,
          ``,
          `دكتور تريو للرعاية الصحية`,
        ].join('\n');

  return sendWhatsAppMessage(phone, message);
}

// ─── Notification: GP Ended ──────────────────────────────────────────────────
// Sent to both parties when the GP relationship is ended.

interface GPEndedData {
  doctorName: string;
  patientName: string;
  endedBy: 'patient' | 'doctor';
}

export async function sendGPEndedNotification(
  phone: string,
  preferredLang: string,
  data: GPEndedData
): Promise<WhatsAppResult> {
  const message =
    preferredLang === 'en'
      ? [
          `The GP relationship with Dr. ${data.doctorName} has been ended${data.endedBy === 'patient' ? ' by you' : ''}.`,
          ``,
          `You can request a new GP at any time through the app.`,
          ``,
          `DoctorTrio Healthcare`,
        ].join('\n')
      : [
          `تم إنهاء علاقة الطبيب العام مع الدكتور ${data.doctorName}${data.endedBy === 'patient' ? ' بواسطتك' : ''}.`,
          ``,
          `يمكنك طلب طبيب عام جديد في أي وقت من خلال التطبيق.`,
          ``,
          `دكتور تريو للرعاية الصحية`,
        ].join('\n');

  return sendWhatsAppMessage(phone, message);
}

// ─── Notification: New Lab Alert to GP ───────────────────────────────────────
// Sent to GP when their patient has new lab results.

interface GPNewLabAlertData {
  patientName: string;
  labTestName: string;
  hasAbnormal: boolean;
}

export async function sendGPNewLabAlert(
  phone: string,
  _preferredLang: string,
  data: GPNewLabAlertData
): Promise<WhatsAppResult> {
  // GP alerts always in Arabic
  const abnormalFlag = data.hasAbnormal ? ' ⚠️ يوجد نتائج غير طبيعية' : '';
  const message = [
    `تنبيه طبيب عام: المريض ${data.patientName} لديه نتائج تحاليل جديدة.`,
    ``,
    `التحليل: ${data.labTestName}${abnormalFlag}`,
    ``,
    `يرجى مراجعة النتائج من لوحة التحكم.`,
    `دكتور تريو للرعاية الصحية`,
  ].join('\n');

  return sendWhatsAppMessage(phone, message);
}

// ─── Notification: New Prescription Alert to GP ──────────────────────────────
// Sent to GP when another doctor prescribes medication to their patient.

interface GPNewPrescriptionAlertData {
  patientName: string;
  prescribingDoctorName: string;
  medicationName: string;
}

export async function sendGPNewPrescriptionAlert(
  phone: string,
  _preferredLang: string,
  data: GPNewPrescriptionAlertData
): Promise<WhatsAppResult> {
  // GP alerts always in Arabic
  const message = [
    `تنبيه طبيب عام: الدكتور ${data.prescribingDoctorName} وصف دواء جديد للمريض ${data.patientName}.`,
    ``,
    `الدواء: ${data.medicationName}`,
    ``,
    `يرجى مراجعة الوصفة من لوحة التحكم.`,
    `دكتور تريو للرعاية الصحية`,
  ].join('\n');

  return sendWhatsAppMessage(phone, message);
}

// ─── Notification: Specialist Visit Alert to GP ─────────────────────────────
// Sent to GP when their patient visits a specialist.

interface GPSpecialistVisitAlertData {
  patientName: string;
  specialistName: string;
  specialtyAr: string;
}

export async function sendGPSpecialistVisitAlert(
  phone: string,
  _preferredLang: string,
  data: GPSpecialistVisitAlertData
): Promise<WhatsAppResult> {
  // GP alerts always in Arabic
  const message = [
    `تنبيه طبيب عام: المريض ${data.patientName} زار أخصائي.`,
    ``,
    `الأخصائي: ${data.specialistName} (${data.specialtyAr})`,
    ``,
    `يرجى مراجعة تفاصيل الزيارة من لوحة التحكم.`,
    `دكتور تريو للرعاية الصحية`,
  ].join('\n');

  return sendWhatsAppMessage(phone, message);
}
