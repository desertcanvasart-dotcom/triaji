'use client';

interface BookingConfirmationProps {
  doctorNameAr: string;
  specialtyNameAr: string;
  dateAr: string;
  timeAr: string;
  clinicAddressAr: string | null;
  consultationFeeEgp: number | null;
  confirmationSentTo: string;
  confirmationChannel: 'whatsapp' | 'sms' | 'both' | null;
  appointmentDatetime: string;
  onNewSession: () => void;
  onGoHome: () => void;
}

/**
 * Generate an .ics calendar file for download.
 */
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
PRODID:-//Triaji//Booking//AR
BEGIN:VEVENT
DTSTART:${fmt(dt)}
DTEND:${fmt(endDt)}
SUMMARY:موعد طبي - ${props.doctorNameAr}
DESCRIPTION:${props.specialtyNameAr}\\nتريجي — الدكتور الصح في المكان الصح
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

export default function BookingConfirmation(props: BookingConfirmationProps) {
  const channelText =
    props.confirmationChannel === 'whatsapp'
      ? 'تم إرسال تفاصيل الموعد إلى واتساب'
      : props.confirmationChannel === 'sms'
        ? 'تم إرسال تفاصيل الموعد عبر رسالة نصية'
        : 'سيتم إرسال تفاصيل الموعد قريباً';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm text-center animate-fade-in-up">
      {/* Success Icon */}
      <div className="text-5xl mb-3">✅</div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">تم الحجز بنجاح</h2>

      {/* Appointment Details */}
      <div className="bg-gray-50 rounded-xl p-4 mb-4 text-right space-y-2">
        <div className="flex items-center gap-2">
          <span>👨‍⚕️</span>
          <span className="font-semibold text-gray-800">{props.doctorNameAr}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>🏥</span>
          <span className="text-gray-600">{props.specialtyNameAr}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>📅</span>
          <span className="text-gray-600">{props.dateAr}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>⏰</span>
          <span className="text-gray-600">{props.timeAr}</span>
        </div>
        {props.clinicAddressAr && (
          <div className="flex items-center gap-2">
            <span>📍</span>
            <span className="text-gray-600">{props.clinicAddressAr}</span>
          </div>
        )}
        {props.consultationFeeEgp !== null && (
          <div className="flex items-center gap-2">
            <span>💰</span>
            <span className="text-gray-600">{props.consultationFeeEgp} جنيه</span>
          </div>
        )}
      </div>

      {/* Confirmation message */}
      <p className="text-sm text-teal-600 font-medium mb-1">{channelText}</p>
      <p className="text-xs text-gray-400 mb-4 ltr-nums">{props.confirmationSentTo}</p>

      {/* Actions */}
      <div className="space-y-2">
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
          📅 إضافة إلى التقويم
        </button>
        <button
          onClick={props.onNewSession}
          className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors"
        >
          حجز موعد آخر
        </button>
        <button
          onClick={props.onGoHome}
          className="w-full text-gray-500 py-2 font-medium hover:text-gray-700 transition-colors"
        >
          العودة للرئيسية
        </button>
      </div>
    </div>
  );
}
