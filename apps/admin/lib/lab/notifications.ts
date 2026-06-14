import { sendWhatsAppMessage } from '@triaji/shared/lib/whatsapp/client';

// ─── Types ───────────────────────────────────────────────────────────────────

type PreferredLanguage = 'ar' | 'en';

interface OrderRoutedData {
  labName: string;
  labAddress: string;
  labPhone: string;
  tests: string[];
  doctorName: string;
  preferredLanguage: PreferredLanguage;
}

interface AppointmentConfirmationData {
  labName: string;
  labAddress: string;
  date: string;
  time: string;
  tests: string[];
  preparationNotes: string | null;
  preferredLanguage: PreferredLanguage;
}

interface ResultsReadyPatientData {
  labName: string;
  tests: string[];
  resultsUrl: string | null;
  preferredLanguage: PreferredLanguage;
}

interface ResultsReadyDoctorData {
  patientName: string;
  labName: string;
  tests: string[];
  routingId: string;
  hasAbnormal: boolean;
}

// ─── Notification Functions ──────────────────────────────────────────────────

/**
 * Notify patient that their lab order has been routed to a lab.
 * Checks preferred_language and sends AR or EN message.
 */
export async function sendOrderRoutedNotification(
  patientPhone: string,
  data: OrderRoutedData
) {
  const testList = data.tests.join('، ');

  const message =
    data.preferredLanguage === 'en'
      ? `Your doctor (${data.doctorName}) has ordered lab tests for you.\n\n` +
        `Tests: ${data.tests.join(', ')}\n` +
        `Lab: ${data.labName}\n` +
        `Address: ${data.labAddress}\n` +
        `Phone: ${data.labPhone}\n\n` +
        `Please visit the lab or book an appointment.\n` +
        `Triajji`
      : `الدكتور ${data.doctorName} طلب لك تحاليل.\n\n` +
        `التحاليل: ${testList}\n` +
        `المعمل: ${data.labName}\n` +
        `العنوان: ${data.labAddress}\n` +
        `التليفون: ${data.labPhone}\n\n` +
        `يرجى زيارة المعمل أو حجز موعد.\n` +
        `ترياچي 🏥`;

  return sendWhatsAppMessage(patientPhone, message);
}

/**
 * Confirm a lab appointment to the patient.
 * Checks preferred_language and sends AR or EN message.
 */
export async function sendAppointmentConfirmation(
  patientPhone: string,
  data: AppointmentConfirmationData
) {
  const testList =
    data.preferredLanguage === 'en'
      ? data.tests.join(', ')
      : data.tests.join('، ');

  const prepNote =
    data.preparationNotes && data.preparationNotes.trim()
      ? data.preferredLanguage === 'en'
        ? `\nPreparation: ${data.preparationNotes}\n`
        : `\nتحضيرات: ${data.preparationNotes}\n`
      : '';

  const message =
    data.preferredLanguage === 'en'
      ? `Your lab appointment is confirmed!\n\n` +
        `Lab: ${data.labName}\n` +
        `Date: ${data.date}\n` +
        `Time: ${data.time}\n` +
        `Tests: ${testList}\n` +
        `Address: ${data.labAddress}\n` +
        prepNote +
        `\nTriajji`
      : `تم تأكيد موعد التحاليل ✅\n\n` +
        `المعمل: ${data.labName}\n` +
        `التاريخ: ${data.date}\n` +
        `الوقت: ${data.time}\n` +
        `التحاليل: ${testList}\n` +
        `العنوان: ${data.labAddress}\n` +
        prepNote +
        `\nترياچي 🏥`;

  return sendWhatsAppMessage(patientPhone, message);
}

/**
 * Notify patient that their lab results are ready.
 * Checks preferred_language and sends AR or EN message.
 */
export async function sendResultsReadyToPatient(
  patientPhone: string,
  data: ResultsReadyPatientData
) {
  const testList =
    data.preferredLanguage === 'en'
      ? data.tests.join(', ')
      : data.tests.join('، ');

  const urlLine = data.resultsUrl
    ? data.preferredLanguage === 'en'
      ? `\nView results: ${data.resultsUrl}\n`
      : `\nلعرض النتائج: ${data.resultsUrl}\n`
    : '';

  const message =
    data.preferredLanguage === 'en'
      ? `Your lab results are ready!\n\n` +
        `Lab: ${data.labName}\n` +
        `Tests: ${testList}\n` +
        urlLine +
        `\nYou can also collect your results from the lab.\n` +
        `Triajji`
      : `نتائج تحاليلك جاهزة! 📋\n\n` +
        `المعمل: ${data.labName}\n` +
        `التحاليل: ${testList}\n` +
        urlLine +
        `\nيمكنك أيضاً استلام النتائج من المعمل.\n` +
        `ترياچي 🏥`;

  return sendWhatsAppMessage(patientPhone, message);
}

/**
 * Notify the referring doctor that results are ready.
 * Always sent in Arabic.
 */
export async function sendResultsReadyToDoctor(
  doctorPhone: string,
  data: ResultsReadyDoctorData
) {
  const testList = data.tests.join('، ');
  const abnormalFlag = data.hasAbnormal
    ? '\n⚠️ ملاحظة: يوجد نتائج غير طبيعية تستدعي المراجعة.'
    : '';

  const message =
    `نتائج تحاليل مريضك جاهزة 📋\n\n` +
    `المريض: ${data.patientName}\n` +
    `المعمل: ${data.labName}\n` +
    `التحاليل: ${testList}\n` +
    `رقم التحويل: ${data.routingId}` +
    abnormalFlag +
    `\n\nترياچي 🏥`;

  return sendWhatsAppMessage(doctorPhone, message);
}
