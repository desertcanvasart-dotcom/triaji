'use client';

import { useState } from 'react';
import type { Lang } from '@triaji/shared/i18n';

// ─── Translations ─────────────────────────────────────────────────────────────

const t = {
  bookingSuccess: { ar: 'تم الحجز بنجاح', en: 'Booking confirmed' },
  paymentPending: { ar: 'في انتظار الدفع', en: 'Awaiting payment' },
  appointmentDetails: { ar: 'تفاصيل الموعد', en: 'Appointment details' },
  doctor: { ar: 'الدكتور', en: 'Doctor' },
  specialty: { ar: 'التخصص', en: 'Specialty' },
  date: { ar: 'التاريخ', en: 'Date' },
  time: { ar: 'الوقت', en: 'Time' },
  address: { ar: 'العنوان', en: 'Address' },
  fee: { ar: 'رسوم الكشف', en: 'Consultation fee' },
  egp: { ar: 'جنيه', en: 'EGP' },
  payAndConfirm: { ar: 'ادفع وأكد الحجز', en: 'Pay and confirm' },
  bookWithoutPayment: { ar: 'احجز بدون دفع مسبق', en: 'Book without pre-payment' },
  redirectingToPayment: { ar: 'جاري التحويل للدفع...', en: 'Redirecting to payment...' },
  confirmationWhatsapp: {
    ar: 'تم إرسال تفاصيل الموعد إلى واتساب',
    en: 'Appointment details sent via WhatsApp',
  },
  confirmationSms: {
    ar: 'تم إرسال تفاصيل الموعد عبر رسالة نصية',
    en: 'Appointment details sent via SMS',
  },
  confirmationPending: {
    ar: 'سيتم إرسال تفاصيل الموعد قريباً',
    en: 'Appointment details will be sent shortly',
  },
  paymentPendingNote: {
    ar: 'سيتم تأكيد حجزك بعد إتمام الدفع. الموعد محجوز مؤقتاً.',
    en: 'Your booking will be confirmed after payment. The slot is temporarily held.',
  },
  consentQuestion: {
    ar: 'هل توافق على مشاركة سجلك الطبي مع',
    en: 'Do you consent to sharing your medical record with',
  },
  consentBefore: { ar: 'قبل موعدك؟', en: 'before your appointment?' },
  consentYes: { ar: 'نعم، أوافق', en: 'Yes, I consent' },
  consentNo: { ar: 'لا شكراً', en: 'No thanks' },
  consentGranted: { ar: 'تم مشاركة سجلك الطبي مع الدكتور', en: 'Medical record shared with the doctor' },
  consentDenied: { ar: 'لم يتم مشاركة السجل الطبي', en: 'Medical record not shared' },
  addToCalendar: { ar: 'إضافة إلى التقويم', en: 'Add to calendar' },
  bookAnother: { ar: 'حجز موعد آخر', en: 'Book another appointment' },
  goHome: { ar: 'العودة للرئيسية', en: 'Go home' },
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingConfirmationProps {
  lang: Lang;
  doctorNameAr: string;
  doctorNameEn?: string;
  doctorId: string;
  specialtyNameAr: string;
  specialtyNameEn?: string;
  dateAr: string;
  dateEn?: string;
  timeAr: string;
  timeEn?: string;
  clinicAddressAr: string | null;
  clinicAddressEn?: string | null;
  consultationFeeEgp: number | null;
  confirmationSentTo: string;
  confirmationChannel: 'whatsapp' | 'sms' | 'both' | null;
  appointmentDatetime: string;
  onNewSession: () => void;
  onGoHome: () => void;
  // Payment fields
  acceptsOnlinePayment?: boolean;
  bookingId?: string;
  sessionId?: string;
  slotId?: string;
  patientName?: string;
  phoneNumber?: string;
}

// ─── ICS Generation ───────────────────────────────────────────────────────────

function generateICS(props: {
  doctorNameAr: string;
  specialtyNameAr: string;
  clinicAddressAr: string | null;
  appointmentDatetime: string;
}): string {
  const dt = new Date(props.appointmentDatetime);
  const endDt = new Date(dt.getTime() + 30 * 60 * 1000);

  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Triajji//Booking//AR
BEGIN:VEVENT
DTSTART:${fmt(dt)}
DTEND:${fmt(endDt)}
SUMMARY:موعد طبي - ${props.doctorNameAr}
DESCRIPTION:${props.specialtyNameAr}\\nترياچي — الدكتور الصح في المكان الصح
LOCATION:${props.clinicAddressAr ?? ''}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
}

function downloadICS(icsContent: string) {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'triaji-appointment.ics';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookingConfirmation(props: BookingConfirmationProps) {
  const { lang } = props;
  const isRtl = lang === 'ar';
  const [consentGranted, setConsentGranted] = useState<boolean | null>(null);
  const [consentLoading, setConsentLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [bookingWithoutPayment, setBookingWithoutPayment] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);

  const showPaymentOptions =
    props.acceptsOnlinePayment &&
    props.consultationFeeEgp !== null &&
    props.consultationFeeEgp > 0 &&
    !bookingWithoutPayment &&
    !paymentPending;

  const doctorName = lang === 'en' && props.doctorNameEn ? props.doctorNameEn : props.doctorNameAr;
  const specialtyName = lang === 'en' && props.specialtyNameEn ? props.specialtyNameEn : props.specialtyNameAr;
  const dateDisplay = lang === 'en' && props.dateEn ? props.dateEn : props.dateAr;
  const timeDisplay = lang === 'en' && props.timeEn ? props.timeEn : props.timeAr;
  const addressDisplay = lang === 'en' && props.clinicAddressEn ? props.clinicAddressEn : props.clinicAddressAr;

  const handleConsent = async (grant: boolean) => {
    setConsentLoading(true);
    try {
      await fetch('/api/patient/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          doctorId: props.doctorId,
          action: grant ? 'grant' : 'revoke',
          appointmentDatetime: props.appointmentDatetime,
        }),
      });
      setConsentGranted(grant);
    } catch {
      // Silent fail — consent is optional
    } finally {
      setConsentLoading(false);
    }
  };

  const handlePayAndConfirm = async () => {
    setPaymentLoading(true);
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: props.sessionId,
          doctorId: props.doctorId,
          slotId: props.slotId,
          patientName: props.patientName,
          phoneNumber: props.phoneNumber,
          payment_requested: true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error ?? (lang === 'ar' ? 'خطأ في إنشاء الحجز' : 'Booking error'));
        setPaymentLoading(false);
        return;
      }

      const data = await res.json();
      // Redirect to payment page
      if (data.paymentReference) {
        setPaymentPending(true);
        window.location.href = `/${lang}/pay/${data.paymentReference}`;
      }
    } catch {
      alert(lang === 'ar' ? 'خطأ في الاتصال' : 'Connection error');
      setPaymentLoading(false);
    }
  };

  const handleBookWithoutPayment = () => {
    setBookingWithoutPayment(true);
  };

  const channelText =
    props.confirmationChannel === 'whatsapp'
      ? t.confirmationWhatsapp[lang]
      : props.confirmationChannel === 'sms'
        ? t.confirmationSms[lang]
        : t.confirmationPending[lang];

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm text-center animate-fade-in-up"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Success / Payment Pending Icon */}
      <div className="text-5xl mb-3">{paymentPending ? '⏳' : '✅'}</div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        {paymentPending ? t.paymentPending[lang] : t.bookingSuccess[lang]}
      </h2>

      {/* Appointment Details */}
      <div className={`bg-gray-50 rounded-xl p-4 mb-4 ${isRtl ? 'text-right' : 'text-left'} space-y-2`}>
        <div className="flex items-center gap-2">
          <span>&#128105;&#8205;&#9877;&#65039;</span>
          <span className="font-semibold text-gray-800">{doctorName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>&#127975;</span>
          <span className="text-gray-600">{specialtyName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>&#128197;</span>
          <span className="text-gray-600">{dateDisplay}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>&#9200;</span>
          <span className="text-gray-600">{timeDisplay}</span>
        </div>
        {addressDisplay && (
          <div className="flex items-center gap-2">
            <span>&#128205;</span>
            <span className="text-gray-600">{addressDisplay}</span>
          </div>
        )}
        {props.consultationFeeEgp !== null && (
          <div className="flex items-center gap-2">
            <span>&#128176;</span>
            <span className="text-gray-600">
              {props.consultationFeeEgp} {t.egp[lang]}
            </span>
          </div>
        )}
      </div>

      {/* Payment Options — shown when provider accepts online payment */}
      {showPaymentOptions && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-4 space-y-3">
          <p className={`text-sm text-gray-700 font-medium ${isRtl ? 'text-right' : 'text-left'}`}>
            {lang === 'ar'
              ? `رسوم الكشف: ${props.consultationFeeEgp} جنيه`
              : `Consultation fee: EGP ${props.consultationFeeEgp}`}
          </p>

          <button
            onClick={handlePayAndConfirm}
            disabled={paymentLoading}
            className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            {paymentLoading
              ? t.redirectingToPayment[lang]
              : `${t.payAndConfirm[lang]} \uD83D\uDCB3`}
          </button>

          <button
            onClick={handleBookWithoutPayment}
            disabled={paymentLoading}
            className="w-full border border-teal-600 text-teal-600 py-3 rounded-xl font-semibold hover:bg-teal-50 transition-colors disabled:opacity-50"
          >
            {t.bookWithoutPayment[lang]}
          </button>
        </div>
      )}

      {/* Payment pending note */}
      {paymentPending && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
          <p className="text-sm text-yellow-800">{t.paymentPendingNote[lang]}</p>
        </div>
      )}

      {/* Confirmation message — shown when NOT in payment flow */}
      {!showPaymentOptions && !paymentPending && (
        <>
          <p className="text-sm text-teal-600 font-medium mb-1">{channelText}</p>
          <p className="text-xs text-gray-400 mb-4 ltr-nums">{props.confirmationSentTo}</p>
        </>
      )}

      {/* History consent — shown when booking is confirmed (no payment flow or after payment) */}
      {!showPaymentOptions && !paymentPending && (
        <>
          {consentGranted === null ? (
            <div className={`bg-teal-50 rounded-xl p-4 mb-4 ${isRtl ? 'text-right' : 'text-left'}`}>
              <p className="text-sm text-gray-700 mb-3">
                {t.consentQuestion[lang]} {doctorName} {t.consentBefore[lang]}
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => handleConsent(true)}
                  disabled={consentLoading}
                  className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50"
                >
                  {t.consentYes[lang]}
                </button>
                <button
                  onClick={() => handleConsent(false)}
                  disabled={consentLoading}
                  className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                >
                  {t.consentNo[lang]}
                </button>
              </div>
            </div>
          ) : consentGranted ? (
            <p className="text-sm text-teal-600 mb-4">{t.consentGranted[lang]}</p>
          ) : (
            <p className="text-sm text-gray-400 mb-4">{t.consentDenied[lang]}</p>
          )}
        </>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {!paymentPending && (
          <button
            onClick={() => {
              const ics = generateICS({
                doctorNameAr: props.doctorNameAr,
                specialtyNameAr: props.specialtyNameAr,
                clinicAddressAr: props.clinicAddressAr,
                appointmentDatetime: props.appointmentDatetime,
              });
              downloadICS(ics);
            }}
            className="w-full border border-teal-600 text-teal-600 py-3 rounded-xl font-semibold hover:bg-teal-50 transition-colors"
          >
            &#128197; {t.addToCalendar[lang]}
          </button>
        )}
        <button
          onClick={props.onNewSession}
          className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors"
        >
          {t.bookAnother[lang]}
        </button>
        <button
          onClick={props.onGoHome}
          className="w-full text-gray-500 py-2 font-medium hover:text-gray-700 transition-colors"
        >
          {t.goHome[lang]}
        </button>
      </div>
    </div>
  );
}
