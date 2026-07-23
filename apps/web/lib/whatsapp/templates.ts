/**
 * WhatsApp Arabic message templates for booking confirmations and reminders.
 * Production note: These use free-form text messages for development.
 * For production, register these as approved WhatsApp Message Templates
 * via Meta Business Manager before sending.
 */

export interface BookingTemplateData {
  patientName: string;
  doctorTitle: string;
  doctorName: string;
  specialtyName: string;
  dateAr: string;
  timeAr: string;
  clinicAddress: string;
  fee: number;
}

export function bookingConfirmationMessage(data: BookingTemplateData): string {
  return `مرحباً ${data.patientName}،

تم تأكيد حجزك بنجاح ✅

📋 تفاصيل الموعد:
👨‍⚕️ الدكتور: ${data.doctorTitle} ${data.doctorName}
🏥 التخصص: ${data.specialtyName}
📅 التاريخ: ${data.dateAr}
⏰ الوقت: ${data.timeAr}
📍 العنوان: ${data.clinicAddress}
💰 رسوم الكشف: ${data.fee} جنيه

للإلغاء أو الاستفسار، تواصل معنا.

دكتور تريو — الدكتور الصح، في المكان الصح 🏥`;
}

export function reminder24hMessage(data: Pick<BookingTemplateData, 'doctorTitle' | 'doctorName' | 'dateAr' | 'timeAr' | 'clinicAddress'>): string {
  return `تذكير بموعدك غداً ⏰

${data.doctorTitle} ${data.doctorName}
${data.dateAr} الساعة ${data.timeAr}
${data.clinicAddress}

دكتور تريو 🏥`;
}

export function reminder2hMessage(data: Pick<BookingTemplateData, 'doctorTitle' | 'doctorName' | 'timeAr'>): string {
  return `موعدك بعد ساعتين ⏰

${data.doctorTitle} ${data.doctorName}
الساعة ${data.timeAr}

نتمنى لك الشفاء العاجل 🌿
دكتور تريو`;
}

export function smsConfirmationMessage(data: Pick<BookingTemplateData, 'doctorTitle' | 'doctorName' | 'dateAr' | 'timeAr' | 'clinicAddress'>): string {
  return `دكتور تريو: تم حجز موعدك مع ${data.doctorTitle} ${data.doctorName}
${data.dateAr} الساعة ${data.timeAr}
${data.clinicAddress}`;
}

// ─── Telehealth Templates ─────────────────────────────────────────────────────

export function telehealthConfirmationMessage(data: BookingTemplateData & { telehealthLink?: string }): string {
  return `مرحباً ${data.patientName}،

تم تأكيد استشارتك الأونلاين

الدكتور: ${data.doctorTitle} ${data.doctorName}
التخصص: ${data.specialtyName}
التاريخ: ${data.dateAr}
الوقت: ${data.timeAr}
نوع الموعد: استشارة أونلاين
رسوم الاستشارة: ${data.fee} جنيه

رابط الاستشارة سيُرسل إليك قبل الموعد بساعة.

دكتور تريو — الدكتور الصح، في المكان الصح`;
}

export function telehealthReminderMessage(data: {
  doctorTitle: string;
  doctorName: string;
  timeAr: string;
  telehealthLink: string;
}): string {
  return `استشارتك الأونلاين بعد ساعة

${data.doctorTitle} ${data.doctorName}
الساعة ${data.timeAr}

انضم من هنا:
${data.telehealthLink}

تأكد من تجهيز الكاميرا والميكروفون قبل الموعد

دكتور تريو`;
}

// ─── Invoice With Payment Templates (Bilingual) ────────────────────────────────

export interface InvoicePaymentTemplateData {
  patientName: string;
  providerName: string;
  invoiceNumber: string;
  totalEgp: number;
  pdfUrl?: string;
  paymentReference: string;
}

const PAYMENT_RETURN_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://doctortrio.online';

/**
 * Clinic invoice with optional online payment link.
 * Used when provider has accepts_online_payment = true.
 */
export function getClinicInvoiceWithPaymentTemplate(
  lang: 'ar' | 'en',
  data: InvoicePaymentTemplateData,
): string {
  if (lang === 'ar') {
    let msg = `مرحباً ${data.patientName}،

فاتورتك من ${data.providerName} جاهزة:

📄 رقم الفاتورة: ${data.invoiceNumber}
💰 الإجمالي: ${data.totalEgp} جنيه`;

    if (data.pdfUrl) {
      msg += `\n\n📥 تحميل الفاتورة:\n${data.pdfUrl}`;
    }

    msg += `\n\n💳 ادفع أونلاين:\n${PAYMENT_RETURN_BASE_URL}/ar/pay/${data.paymentReference}`;
    msg += '\n\nدكتور تريو 🏥';
    return msg;
  }

  let msg = `Hello ${data.patientName},

Your invoice from ${data.providerName} is ready:

📄 Invoice: ${data.invoiceNumber}
💰 Total: EGP ${data.totalEgp}`;

  if (data.pdfUrl) {
    msg += `\n\n📥 Download invoice:\n${data.pdfUrl}`;
  }

  msg += `\n\n💳 Pay Online:\n${PAYMENT_RETURN_BASE_URL}/en/pay/${data.paymentReference}`;
  msg += '\n\nDoctorTrio 🏥';
  return msg;
}

/**
 * Pharmacy invoice with optional online payment link.
 */
export function getPharmacyInvoiceWithPaymentTemplate(
  lang: 'ar' | 'en',
  data: InvoicePaymentTemplateData,
): string {
  if (lang === 'ar') {
    let msg = `مرحباً ${data.patientName}،

فاتورتك من صيدلية ${data.providerName} جاهزة:

📄 رقم الفاتورة: ${data.invoiceNumber}
💰 الإجمالي: ${data.totalEgp} جنيه`;

    if (data.pdfUrl) {
      msg += `\n\n📥 تحميل الفاتورة:\n${data.pdfUrl}`;
    }

    msg += `\n\n💳 ادفع أونلاين:\n${PAYMENT_RETURN_BASE_URL}/ar/pay/${data.paymentReference}`;
    msg += '\n\nدكتور تريو 🏥';
    return msg;
  }

  let msg = `Hello ${data.patientName},

Your invoice from ${data.providerName} Pharmacy is ready:

📄 Invoice: ${data.invoiceNumber}
💰 Total: EGP ${data.totalEgp}`;

  if (data.pdfUrl) {
    msg += `\n\n📥 Download invoice:\n${data.pdfUrl}`;
  }

  msg += `\n\n💳 Pay Online:\n${PAYMENT_RETURN_BASE_URL}/en/pay/${data.paymentReference}`;
  msg += '\n\nDoctorTrio 🏥';
  return msg;
}

/**
 * Lab invoice with optional online payment link.
 */
export function getLabInvoiceWithPaymentTemplate(
  lang: 'ar' | 'en',
  data: InvoicePaymentTemplateData,
): string {
  if (lang === 'ar') {
    let msg = `مرحباً ${data.patientName}،

فاتورتك من معمل ${data.providerName} جاهزة:

📄 رقم الطلب: ${data.invoiceNumber}
💰 الإجمالي: ${data.totalEgp} جنيه`;

    if (data.pdfUrl) {
      msg += `\n\n📥 تحميل الفاتورة:\n${data.pdfUrl}`;
    }

    msg += `\n\n💳 ادفع أونلاين:\n${PAYMENT_RETURN_BASE_URL}/ar/pay/${data.paymentReference}`;
    msg += '\n\nدكتور تريو 🏥';
    return msg;
  }

  let msg = `Hello ${data.patientName},

Your invoice from ${data.providerName} Lab is ready:

📄 Order: ${data.invoiceNumber}
💰 Total: EGP ${data.totalEgp}`;

  if (data.pdfUrl) {
    msg += `\n\n📥 Download invoice:\n${data.pdfUrl}`;
  }

  msg += `\n\n💳 Pay Online:\n${PAYMENT_RETURN_BASE_URL}/en/pay/${data.paymentReference}`;
  msg += '\n\nDoctorTrio 🏥';
  return msg;
}

/**
 * Generic wrapper: picks the right template based on payable_type.
 */
export function getInvoiceWithPaymentTemplate(
  lang: 'ar' | 'en',
  payableType: 'clinic_invoice' | 'pharmacy_invoice' | 'lab_invoice',
  data: InvoicePaymentTemplateData,
): string {
  switch (payableType) {
    case 'clinic_invoice':
      return getClinicInvoiceWithPaymentTemplate(lang, data);
    case 'pharmacy_invoice':
      return getPharmacyInvoiceWithPaymentTemplate(lang, data);
    case 'lab_invoice':
      return getLabInvoiceWithPaymentTemplate(lang, data);
    default:
      return getClinicInvoiceWithPaymentTemplate(lang, data);
  }
}

/**
 * Booking payment expiry template — sent when slot is released.
 * AMENDMENT: Always includes a new booking link so patient can rebook.
 */
export function bookingPaymentExpiredMessage(
  lang: 'ar' | 'en',
  data: {
    patientName: string;
    doctorName: string;
    newBookingLink: string;
  },
): string {
  if (lang === 'ar') {
    return `مرحباً ${data.patientName}،

تم إلغاء حجزك مع ${data.doctorName} لانتهاء مدة الدفع.

تم تحرير الموعد ويمكنك الحجز مرة أخرى من هنا:
${data.newBookingLink}

دكتور تريو 🏥`;
  }

  return `Hello ${data.patientName},

Your appointment with ${data.doctorName} was cancelled due to payment expiry.

The slot has been released. You can book again here:
${data.newBookingLink}

DoctorTrio 🏥`;
}

// ─── Phone Call Handoff Templates ────────────────────────────────────────────

export function handoffPatientMessage(shortRef: string): string {
  return `[دكتور تريو] تم تحويلك لأحد موظفينا.
رقمك المرجعي: ${shortRef}
احتفظ بهذا الرقم للمتابعة.

دكتور تريو — الدكتور الصح، في المكان الصح`;
}

export function handoffAgentMessage(data: {
  shortRef: string;
  phone: string;
  time: string;
  chiefComplaint: string | null;
  symptoms: string[];
  specialty: string | null;
  reason: string;
}): string {
  const symptomsList = data.symptoms.length > 0 ? data.symptoms.join('، ') : 'غير محدد';
  return `[دكتور تريو] تحويل مريض

الرقم المرجعي: ${data.shortRef}
المتصل: ${data.phone}
الوقت: ${data.time}

ملخص المحادثة:
الشكوى الرئيسية: ${data.chiefComplaint ?? 'غير محدد'}
الأعراض: ${symptomsList}
التخصص المرجح: ${data.specialty ?? 'غير محدد'}
السبب: ${data.reason}

---
يمكنك متابعة المحادثة في لوحة دكتور تريو.`;
}
