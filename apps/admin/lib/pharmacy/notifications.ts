import { sendWhatsAppMessage } from '@triaji/shared/lib/whatsapp/client';

// ─── Types ───────────────────────────────────────────────────────────────────

type PreferredLanguage = 'ar' | 'en';

interface PrescriptionRoutedData {
  pharmacyName: string;
  pharmacyAddress: string;
  pharmacyPhone: string;
  doctorName: string;
  medicationCount: number;
}

interface PharmacyReceivedData {
  pharmacyName: string;
  prepTimeMinutes: number | null;
}

interface PrescriptionReadyData {
  pharmacyName: string;
  pharmacyAddress: string;
  pharmacyPhone: string;
  statusUrl: string | null;
}

interface PartialReadyData {
  pharmacyName: string;
  pharmacyAddress: string;
  availableMeds: string[];
  unavailableMeds: string[];
}

interface CollectedDoctorData {
  patientName: string;
  pharmacyName: string;
  routingId: string;
  medicationCount: number;
  hasSubstitutes: boolean;
}

// ─── Notification Functions ──────────────────────────────────────────────────

/**
 * Notify patient that their prescription was sent to a pharmacy.
 * Always includes "bring original prescription" note.
 */
export async function sendPrescriptionRoutedNotification(
  phone: string,
  preferredLang: PreferredLanguage,
  data: PrescriptionRoutedData
) {
  const message =
    preferredLang === 'en'
      ? `Your prescription has been sent to ${data.pharmacyName}.\n\n` +
        `Doctor: ${data.doctorName}\n` +
        `Medications: ${data.medicationCount} items\n` +
        `Pharmacy address: ${data.pharmacyAddress}\n` +
        `Phone: ${data.pharmacyPhone}\n\n` +
        `Please bring your original prescription when collecting.\n` +
        `Triajji`
      : `تم إرسال روشتتك لصيدلية ${data.pharmacyName}.\n\n` +
        `الطبيب: ${data.doctorName}\n` +
        `عدد الأدوية: ${data.medicationCount}\n` +
        `عنوان الصيدلية: ${data.pharmacyAddress}\n` +
        `التليفون: ${data.pharmacyPhone}\n\n` +
        `لازم تاخد معاك الروشتة الأصلية عند الاستلام.\n` +
        `ترياچي 🏥`;

  return sendWhatsAppMessage(phone, message);
}

/**
 * Notify patient that the pharmacy received their prescription and is preparing.
 */
export async function sendPharmacyReceivedNotification(
  phone: string,
  preferredLang: PreferredLanguage,
  data: PharmacyReceivedData
) {
  const prepNote = data.prepTimeMinutes
    ? preferredLang === 'en'
      ? `Estimated preparation time: ${data.prepTimeMinutes} minutes.\n`
      : `الوقت المقدر للتحضير: ${data.prepTimeMinutes} دقيقة.\n`
    : '';

  const message =
    preferredLang === 'en'
      ? `${data.pharmacyName} has received your prescription and is preparing your medications.\n\n` +
        prepNote +
        `We'll notify you when it's ready for pickup.\n` +
        `Triajji`
      : `صيدلية ${data.pharmacyName} استلمت روشتتك وجاري تحضير الأدوية.\n\n` +
        prepNote +
        `هنبلغك لما تكون جاهزة للاستلام.\n` +
        `ترياچي 🏥`;

  return sendWhatsAppMessage(phone, message);
}

/**
 * Notify patient that their prescription is ready for pickup.
 * Includes pharmacy address.
 */
export async function sendPrescriptionReadyNotification(
  phone: string,
  preferredLang: PreferredLanguage,
  data: PrescriptionReadyData
) {
  const urlLine = data.statusUrl
    ? preferredLang === 'en'
      ? `\nTrack status: ${data.statusUrl}\n`
      : `\nمتابعة الحالة: ${data.statusUrl}\n`
    : '';

  const message =
    preferredLang === 'en'
      ? `Your prescription is ready for pickup at ${data.pharmacyName}!\n\n` +
        `Address: ${data.pharmacyAddress}\n` +
        `Phone: ${data.pharmacyPhone}\n` +
        urlLine +
        `\nPlease bring your original prescription.\n` +
        `Triajji`
      : `روشتتك جاهزة للاستلام من صيدلية ${data.pharmacyName}!\n\n` +
        `العنوان: ${data.pharmacyAddress}\n` +
        `التليفون: ${data.pharmacyPhone}\n` +
        urlLine +
        `\nلازم تاخد معاك الروشتة الأصلية.\n` +
        `ترياچي 🏥`;

  return sendWhatsAppMessage(phone, message);
}

/**
 * Notify patient that their prescription is partially ready.
 * Lists available and unavailable medications.
 */
export async function sendPartialReadyNotification(
  phone: string,
  preferredLang: PreferredLanguage,
  data: PartialReadyData
) {
  const message =
    preferredLang === 'en'
      ? `Your prescription at ${data.pharmacyName} is partially ready.\n\n` +
        `Available:\n${data.availableMeds.map((m) => `  - ${m}`).join('\n')}\n\n` +
        `Not available:\n${data.unavailableMeds.map((m) => `  - ${m}`).join('\n')}\n\n` +
        `Address: ${data.pharmacyAddress}\n` +
        `Please bring your original prescription.\n` +
        `Triajji`
      : `روشتتك في صيدلية ${data.pharmacyName} جاهزة جزئياً.\n\n` +
        `متوفر:\n${data.availableMeds.map((m) => `  - ${m}`).join('\n')}\n\n` +
        `غير متوفر:\n${data.unavailableMeds.map((m) => `  - ${m}`).join('\n')}\n\n` +
        `العنوان: ${data.pharmacyAddress}\n` +
        `لازم تاخد معاك الروشتة الأصلية.\n` +
        `ترياچي 🏥`;

  return sendWhatsAppMessage(phone, message);
}

/**
 * Notify the referring doctor that the patient has collected their prescription.
 * Always sent in Arabic.
 */
export async function sendCollectedNotificationToDoctor(
  doctorPhone: string,
  data: CollectedDoctorData
) {
  const substituteNote = data.hasSubstitutes
    ? '\n⚠️ ملاحظة: تم صرف بدائل لبعض الأدوية.'
    : '';

  const message =
    `تم استلام أدوية مريضك 💊\n\n` +
    `المريض: ${data.patientName}\n` +
    `الصيدلية: ${data.pharmacyName}\n` +
    `عدد الأدوية: ${data.medicationCount}\n` +
    `رقم التحويل: ${data.routingId}` +
    substituteNote +
    `\n\nترياچي 🏥`;

  return sendWhatsAppMessage(doctorPhone, message);
}
