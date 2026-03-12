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

تريجي — الدكتور الصح، في المكان الصح 🏥`;
}

export function reminder24hMessage(data: Pick<BookingTemplateData, 'doctorTitle' | 'doctorName' | 'dateAr' | 'timeAr' | 'clinicAddress'>): string {
  return `تذكير بموعدك غداً ⏰

${data.doctorTitle} ${data.doctorName}
${data.dateAr} الساعة ${data.timeAr}
${data.clinicAddress}

تريجي 🏥`;
}

export function reminder2hMessage(data: Pick<BookingTemplateData, 'doctorTitle' | 'doctorName' | 'timeAr'>): string {
  return `موعدك بعد ساعتين ⏰

${data.doctorTitle} ${data.doctorName}
الساعة ${data.timeAr}

نتمنى لك الشفاء العاجل 🌿
تريجي`;
}

export function smsConfirmationMessage(data: Pick<BookingTemplateData, 'doctorTitle' | 'doctorName' | 'dateAr' | 'timeAr' | 'clinicAddress'>): string {
  return `تريجي: تم حجز موعدك مع ${data.doctorTitle} ${data.doctorName}
${data.dateAr} الساعة ${data.timeAr}
${data.clinicAddress}`;
}
