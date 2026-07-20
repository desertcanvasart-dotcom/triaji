'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import type { DoctorRecommendation, MatchedDoctor } from '@triaji/shared/types';
import { s, type Lang } from '@triaji/shared/i18n';
import DoctorList from '@/components/booking/DoctorList';
import SlotPicker from '@/components/booking/SlotPicker';
import PatientForm from '@/components/booking/PatientForm';
import BookingConfirmation from '@/components/booking/BookingConfirmation';
import VoiceButton from '@/components/chat/VoiceButton';
import LanguageToggle from '@/components/shared/LanguageToggle';

interface ChatMessage {
  id: string;
  role: 'patient' | 'ai';
  content: string;
  imageUrls?: string[];
}

interface ChatResult {
  response: string;
  isEmergency: boolean;
  sessionComplete: boolean;
  recommendation?: DoctorRecommendation;
  emergency?: {
    escalationType: string;
    reasonAr: string;
    instructionsAr: string;
  };
}

interface BookingData {
  bookingId: string;
  appointmentDatetime: string;
  doctorNameAr: string;
  specialtyNameAr: string;
  clinicAddressAr: string | null;
  consultationFeeEgp: number | null;
  confirmationSentTo: string;
  confirmationChannel: 'whatsapp' | 'sms' | 'both' | null;
  dateAr: string;
  timeAr: string;
}

interface SelectedSlot {
  id: string;
  slotDatetime: string;
  durationMinutes: number;
  dayAr: string;
  dateAr: string;
  timeAr: string;
}

type BookingStep = 'none' | 'slot-picker' | 'patient-form' | 'confirmed';

interface ChatClientProps {
  lang: Lang;
}

const MAX_IMAGES_PER_SESSION = 3;

/**
 * Memoized message list — ChatClient re-renders on every keystroke (input
 * state lives there), but the conversation itself only changes when a message
 * is added, so the whole list can skip those renders.
 */
const MessageList = memo(function MessageList({
  messages,
  isRtl,
  lang,
}: {
  messages: ChatMessage[];
  isRtl: boolean;
  lang: Lang;
}) {
  return (
    <>
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'patient' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-3 whitespace-pre-wrap ${
              msg.role === 'patient'
                ? isRtl
                  ? 'bg-teal-600 text-white rounded-br-md'
                  : 'bg-teal-600 text-white rounded-bl-md'
                : isRtl
                  ? 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md'
                  : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-br-md'
            }`}
          >
            {msg.imageUrls && msg.imageUrls.length > 0 && (
              <div className="flex gap-1 mb-2">
                <span className="text-xs opacity-70">📷 {msg.imageUrls.length} {s.chat.imagesAttached[lang]}</span>
              </div>
            )}
            {msg.content}
          </div>
        </div>
      ))}
    </>
  );
});

export default function ChatClient({ lang }: ChatClientProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'active' | 'completed' | 'escalated'>('idle');
  const [recommendation, setRecommendation] = useState<DoctorRecommendation | null>(null);
  const [emergencyInfo, setEmergencyInfo] = useState<ChatResult['emergency'] | undefined>(undefined);

  // Booking flow state
  const [bookingStep, setBookingStep] = useState<BookingStep>('none');
  const [selectedDoctor, setSelectedDoctor] = useState<MatchedDoctor | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Image upload state
  const [imageCount, setImageCount] = useState(0);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Sign-up gate state
  const [showSignUpGate, setShowSignUpGate] = useState(false);
  const [gatePhone, setGatePhone] = useState('');
  const [gateConsent, setGateConsent] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [gateStep, setGateStep] = useState<'phone' | 'otp'>('phone');
  const [gateOtp, setGateOtp] = useState('');
  const [gateLoading, setGateLoading] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionStartedRef = useRef(false);

  const isRtl = lang === 'ar';

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, recommendation, bookingData, scrollToBottom]);

  const updateSessionLocation = useCallback(async (sid: string) => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await fetch('/api/session', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: sid,
              patientLat: pos.coords.latitude,
              patientLng: pos.coords.longitude,
            }),
          });
        } catch {
          // Silently fail — geo is best-effort
        }
      },
      () => {
        // Geolocation denied or timed out — add a subtle notice (once per conversation)
        setMessages((prev) => prev.some((m) => m.id === 'sys-geo') ? prev : [
          ...prev,
          {
            id: 'sys-geo',
            role: 'ai' as const,
            content: lang === 'ar'
              ? '📍 لم نتمكن من تحديد موقعك — هنبحثلك عن أطباء في كل المناطق.'
              : '📍 Could not determine your location — we\'ll search for doctors in all areas.',
          },
        ]);
      },
      { enableHighAccuracy: false, timeout: 5000 }
    );
  }, [lang]);

  const startSession = useCallback(async () => {
    setIsLoading(true);
    setMessages([]);
    setRecommendation(null);
    setEmergencyInfo(undefined);
    setBookingStep('none');
    setSelectedDoctor(null);
    setSelectedSlot(null);
    setBookingData(null);
    setBookingError(null);
    setImageCount(0);
    setPendingImages([]);
    setPendingPreviews([]);

    try {
      const sessionRes = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: null, channel: 'app' }),
      });
      const sessionData = (await sessionRes.json()) as { session: { id: string }; error?: string };
      if (!sessionRes.ok || !sessionData.session) {
        throw new Error(sessionData.error ?? 'Failed to create session');
      }

      const newSessionId = sessionData.session.id;
      setSessionId(newSessionId);
      setSessionStatus('active');
      updateSessionLocation(newSessionId);

      setMessages([{
        id: 'welcome',
        role: 'ai',
        content: s.chat.welcome[lang],
      }]);
    } catch (err) {
      console.error('Failed to start session:', err);
      setMessages([{
        id: 'error',
        role: 'ai',
        content: s.chat.sessionError[lang],
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [lang, updateSessionLocation]);

  useEffect(() => {
    // Guard against React StrictMode double-invocation creating two sessions
    if (sessionStartedRef.current) return;
    sessionStartedRef.current = true;
    startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Image handling
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = MAX_IMAGES_PER_SESSION - imageCount - pendingImages.length;
    if (remaining <= 0) {
      alert(s.chat.maxImages[lang]);
      return;
    }

    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const file = files[i];
      if (!file) continue;

      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        alert(s.chat.imageTypesOnly[lang]);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert(s.chat.imageTooLarge[lang]);
        continue;
      }

      newFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    setPendingImages((prev) => [...prev, ...newFiles]);
    setPendingPreviews((prev) => [...prev, ...newPreviews]);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePendingImage = (index: number) => {
    URL.revokeObjectURL(pendingPreviews[index] ?? '');
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
    setPendingPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    const text = input.trim();
    if ((!text && pendingImages.length === 0) || !sessionId || isLoading || sessionStatus !== 'active') return;

    setInput('');
    setIsLoading(true);

    // Upload images first if any
    let imageUrls: string[] = [];
    if (pendingImages.length > 0) {
      setIsUploading(true);
      try {
        const { uploadSessionImage } = await import('@/lib/storage/image-upload');
        const uploadPromises = pendingImages.map((file) => uploadSessionImage(file, sessionId));
        const results = await Promise.all(uploadPromises);
        imageUrls = results.map((r) => r.url);
        setImageCount((prev) => prev + imageUrls.length);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : s.chat.sendError[lang];
        setMessages((prev) => [...prev, {
          id: `err-${Date.now()}`,
          role: 'ai',
          content: errorMsg,
        }]);
        setIsLoading(false);
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
        pendingPreviews.forEach((url) => URL.revokeObjectURL(url));
        setPendingImages([]);
        setPendingPreviews([]);
      }
    }

    const patientMsg: ChatMessage = {
      id: `p-${Date.now()}`,
      role: 'patient',
      content: text || `📷 ${s.chat.imagesAttached[lang]}`,
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    };
    setMessages((prev) => [...prev, patientMsg]);

    // Sign-up gate: pause after 3rd patient message
    const patientCount = messages.filter((m) => m.role === 'patient').length + 1; // +1 for the one just added
    if (patientCount >= 3 && !guestMode && !showSignUpGate) {
      const aiPauseMsg: ChatMessage = {
        id: `a-gate-${Date.now()}`,
        role: 'ai',
        content: s.signUpGate.aiPause[lang],
      };
      setMessages((prev) => [...prev, aiPauseMsg]);
      setShowSignUpGate(true);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: text || 'المريض أرسل صورة للأعراض',
          imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
          lang,
        }),
      });
      const data = (await res.json()) as ChatResult & { error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to send message');
      }

      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'ai',
        content: data.response,
      };
      setMessages((prev) => [...prev, aiMsg]);

      if (data.isEmergency) {
        setSessionStatus('escalated');
        setEmergencyInfo(data.emergency);
      } else if (data.sessionComplete && data.recommendation) {
        setSessionStatus('completed');
        setRecommendation(data.recommendation);
      } else if (data.sessionComplete) {
        setSessionStatus('completed');
      }
    } catch (err) {
      console.error('Chat send failed:', err);
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`,
        role: 'ai',
        content: s.chat.sendError[lang],
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleVoiceTranscription = useCallback((text: string) => {
    setInput((prev) => {
      const prefix = prev.trim() ? prev.trim() + ' ' : '';
      return prefix + text;
    });
    inputRef.current?.focus();
  }, []);

  // Booking flow handlers
  const handleBookDoctor = (doctor: MatchedDoctor, _appointmentType?: 'in_person' | 'telehealth') => {
    setSelectedDoctor(doctor);
    setBookingStep('slot-picker');
    setBookingError(null);
  };

  const handleSelectSlot = (slot: SelectedSlot) => {
    setSelectedSlot(slot);
    setBookingStep('patient-form');
  };

  const handleConfirmBooking = async (data: { patientName: string; phoneNumber: string }) => {
    if (!sessionId || !selectedDoctor || !selectedSlot) return;

    setIsBooking(true);
    setBookingError(null);

    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          doctorId: selectedDoctor.id,
          slotId: selectedSlot.id,
          patientName: data.patientName,
          phoneNumber: data.phoneNumber,
        }),
      });

      const result = (await res.json()) as BookingData & { error?: string };

      if (res.status === 409) {
        setBookingError(result.error ?? s.booking.slotConflict[lang]);
        setBookingStep('slot-picker');
        return;
      }

      if (!res.ok) {
        throw new Error(result.error ?? s.booking.bookingFailed[lang]);
      }

      setBookingData(result);
      setBookingStep('confirmed');
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : s.booking.bookingFailed[lang]);
    } finally {
      setIsBooking(false);
    }
  };

  const handleNewSession = () => {
    setSessionId(null);
    setSessionStatus('idle');
    startSession();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <main className={`min-h-screen flex flex-col bg-gray-50 ${!isRtl ? 'font-sans' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-teal-600 text-white py-4 px-6 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">{s.common.appName[lang]}</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm opacity-80">{s.chat.headerSubtitle[lang]}</span>
            <LanguageToggle lang={lang} />
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto chat-scroll">
        <div className="max-w-2xl mx-auto w-full p-4 space-y-4">
          <MessageList messages={messages} isRtl={isRtl} lang={lang} />

          {/* Sign-Up Gate Card */}
          {showSignUpGate && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 max-w-sm w-full mt-1" style={{ borderTopLeftRadius: '0.25rem' }}>
                <h3 className="text-gray-900 font-bold text-base mb-4 text-center">
                  {s.signUpGate.cardTitle[lang]}
                </h3>

                {gateStep === 'phone' ? (
                  <>
                    {/* Phone input */}
                    <div className="mb-4">
                      <label className="block text-gray-600 text-xs font-medium mb-1.5">
                        {s.signUpGate.phoneLabel[lang]}
                      </label>
                      <input
                        type="tel"
                        dir="ltr"
                        placeholder={s.signUpGate.phonePlaceholder[lang]}
                        value={gatePhone}
                        onChange={(e) => { setGatePhone(e.target.value); setGateError(null); }}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </div>

                    {/* Consent checkbox */}
                    <div className="mb-4 flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="consent-checkbox"
                        checked={gateConsent}
                        onChange={(e) => setGateConsent(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer shrink-0"
                      />
                      <label htmlFor="consent-checkbox" className="text-gray-500 text-xs leading-relaxed cursor-pointer">
                        {s.signUpGate.consentText[lang]}{' '}
                        <a
                          href={`/${lang}/privacy`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-600 hover:text-teal-500 underline underline-offset-2"
                        >
                          {s.signUpGate.privacyLink[lang]}
                        </a>
                      </label>
                    </div>

                    {/* Security strip */}
                    <div className="bg-gray-50 rounded-xl p-3 mb-4">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-gray-500 text-xs">{s.signUpGate.encrypted[lang]}</span>
                        <span className="text-gray-500 text-xs">{s.signUpGate.notShared[lang]}</span>
                        <span className="text-gray-500 text-xs">{s.signUpGate.secured[lang]}</span>
                      </div>
                    </div>

                    {/* Error */}
                    {gateError && (
                      <p className="text-red-500 text-xs mb-3 text-center">{gateError}</p>
                    )}

                    {/* Submit button */}
                    <button
                      disabled={!gateConsent || gatePhone.replace(/\D/g, '').length < 11 || gateLoading}
                      onClick={async () => {
                        setGateLoading(true);
                        setGateError(null);
                        try {
                          const res = await fetch('/api/patient/auth/request-otp', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phone: gatePhone.replace(/\D/g, '') }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error ?? 'Failed');
                          setGateStep('otp');
                        } catch (err) {
                          setGateError(err instanceof Error ? err.message : s.common.error[lang]);
                        } finally {
                          setGateLoading(false);
                        }
                      }}
                      className="w-full bg-teal-600 text-white font-bold py-3 rounded-xl text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-teal-500 hover:shadow-md"
                    >
                      {gateLoading ? '...' : s.signUpGate.submitOTP[lang]}
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-3 my-3">
                      <div className="h-px flex-1 bg-gray-100" />
                      <span className="text-gray-300 text-xs">{s.signUpGate.or[lang]}</span>
                      <div className="h-px flex-1 bg-gray-100" />
                    </div>

                    {/* Guest option */}
                    <button
                      onClick={() => {
                        setGuestMode(true);
                        setShowSignUpGate(false);
                        // Re-send the last patient message through the API
                        const lastPatientMsg = messages.filter((m) => m.role === 'patient').pop();
                        if (lastPatientMsg) {
                          setIsLoading(true);
                          fetch('/api/chat', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionId, message: lastPatientMsg.content, lang }),
                          })
                            .then((r) => r.json())
                            .then((data) => {
                              setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'ai', content: data.response }]);
                              if (data.isEmergency) { setSessionStatus('escalated'); setEmergencyInfo(data.emergency); }
                              else if (data.sessionComplete && data.recommendation) { setSessionStatus('completed'); setRecommendation(data.recommendation); }
                              else if (data.sessionComplete) { setSessionStatus('completed'); }
                            })
                            .catch(() => {})
                            .finally(() => setIsLoading(false));
                        }
                      }}
                      className="w-full text-gray-400 text-xs py-2 hover:text-gray-600 transition-colors"
                    >
                      {s.signUpGate.guestButton[lang]}
                      <span className="block text-gray-300 text-xs mt-0.5">
                        {s.signUpGate.guestNote[lang]}
                      </span>
                    </button>
                  </>
                ) : (
                  /* OTP step */
                  <>
                    <p className="text-gray-500 text-xs mb-3 text-center">
                      {s.signUpGate.otpSent[lang]} {gatePhone}
                    </p>
                    <input
                      type="text"
                      dir="ltr"
                      maxLength={6}
                      placeholder={s.signUpGate.otpPlaceholder[lang]}
                      value={gateOtp}
                      onChange={(e) => { setGateOtp(e.target.value.replace(/\D/g, '')); setGateError(null); }}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent mb-3"
                    />
                    {gateError && (
                      <p className="text-red-500 text-xs mb-3 text-center">{gateError}</p>
                    )}
                    <button
                      disabled={gateOtp.length < 6 || gateLoading}
                      onClick={async () => {
                        setGateLoading(true);
                        setGateError(null);
                        try {
                          const res = await fetch('/api/patient/auth/verify-otp', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phone: gatePhone.replace(/\D/g, ''), otp: gateOtp }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error ?? 'Failed');
                          // OTP verified — dismiss gate and resume conversation
                          setShowSignUpGate(false);
                          setIsLoading(true);
                          const lastPatientMsg = messages.filter((m) => m.role === 'patient').pop();
                          if (lastPatientMsg) {
                            const chatRes = await fetch('/api/chat', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ sessionId, message: lastPatientMsg.content, lang }),
                            });
                            const chatData = await chatRes.json();
                            setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'ai', content: chatData.response }]);
                            if (chatData.isEmergency) { setSessionStatus('escalated'); setEmergencyInfo(chatData.emergency); }
                            else if (chatData.sessionComplete && chatData.recommendation) { setSessionStatus('completed'); setRecommendation(chatData.recommendation); }
                            else if (chatData.sessionComplete) { setSessionStatus('completed'); }
                          }
                          setIsLoading(false);
                        } catch (err) {
                          setGateError(err instanceof Error ? err.message : s.common.error[lang]);
                        } finally {
                          setGateLoading(false);
                        }
                      }}
                      className="w-full bg-teal-600 text-white font-bold py-3 rounded-xl text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-teal-500 hover:shadow-md"
                    >
                      {gateLoading ? '...' : s.signUpGate.verifyOTP[lang]}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {(isLoading || isUploading) && (
            <div className="flex justify-start">
              <div className="bg-white text-gray-400 shadow-sm border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                <span className="animate-pulse">
                  {isUploading ? s.chat.uploading[lang] : s.chat.typing[lang]}
                </span>
              </div>
            </div>
          )}

          {/* Emergency Banner */}
          {sessionStatus === 'escalated' && emergencyInfo && (
            <div className="bg-red-50 border-2 border-red-500 rounded-xl p-4 text-center">
              <p className="text-red-700 font-bold text-lg mb-2">{s.emergency.title[lang]}</p>
              <p className="text-red-600">{emergencyInfo.instructionsAr}</p>
              <p className="text-red-500 text-sm mt-2">{s.emergency.callNow[lang]}</p>
            </div>
          )}

          {/* Doctor Recommendation */}
          {sessionStatus === 'completed' && recommendation && bookingStep !== 'confirmed' && (
            <DoctorList recommendation={recommendation} onBookDoctor={handleBookDoctor} lang={lang} />
          )}

          {/* Booking Confirmation */}
          {bookingStep === 'confirmed' && bookingData && (
            <BookingConfirmation
              lang={lang}
              doctorNameAr={bookingData.doctorNameAr}
              doctorId={selectedDoctor?.id ?? ''}
              specialtyNameAr={bookingData.specialtyNameAr}
              dateAr={bookingData.dateAr}
              timeAr={bookingData.timeAr}
              clinicAddressAr={bookingData.clinicAddressAr}
              consultationFeeEgp={bookingData.consultationFeeEgp}
              confirmationSentTo={bookingData.confirmationSentTo}
              confirmationChannel={bookingData.confirmationChannel}
              appointmentDatetime={bookingData.appointmentDatetime}
              onNewSession={handleNewSession}
              onGoHome={handleGoHome}
            />
          )}

          {/* New Session Button (non-booking paths) */}
          {(sessionStatus === 'completed' || sessionStatus === 'escalated') && bookingStep !== 'confirmed' && (
            <div className="text-center pt-2 pb-4">
              <button
                onClick={handleNewSession}
                className="bg-teal-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors"
              >
                {s.chat.newSession[lang]}
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t bg-white p-4 shadow-inner">
        <div className="max-w-2xl mx-auto">
          {/* Image previews */}
          {pendingPreviews.length > 0 && (
            <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
              {pendingPreviews.map((url, i) => (
                <div key={i} className="relative flex-shrink-0">
                  <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover" />
                  <button
                    onClick={() => removePendingImage(i)}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 items-center">
            {/* Image upload button */}
            {sessionStatus === 'active' && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isUploading || imageCount >= MAX_IMAGES_PER_SESSION}
                className="text-gray-400 hover:text-teal-600 transition-colors disabled:opacity-30"
                title={imageCount >= MAX_IMAGES_PER_SESSION ? s.chat.maxImagesReached[lang] : s.chat.attachImage[lang]}
              >
                📎
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />

            {sessionStatus === 'active' && (
              <VoiceButton
                onTranscription={handleVoiceTranscription}
                disabled={isLoading || isUploading}
              />
            )}

            <input
              ref={inputRef}
              type="text"
              dir={isRtl ? 'rtl' : 'ltr'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                sessionStatus === 'active'
                  ? s.chat.placeholder[lang]
                  : s.chat.placeholderDone[lang]
              }
              className={`flex-1 border border-gray-300 rounded-xl px-4 py-3 ${isRtl ? 'text-right' : 'text-left'} focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed`}
              disabled={isLoading || isUploading || sessionStatus !== 'active' || showSignUpGate}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || isUploading || (!input.trim() && pendingImages.length === 0) || sessionStatus !== 'active' || showSignUpGate}
              className="bg-teal-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {s.chat.send[lang]}
            </button>
          </div>

          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-400">
              {s.common.disclaimer[lang]}
            </p>
            {sessionStatus === 'active' && imageCount > 0 && (
              <span className="text-xs text-gray-400 ltr-nums">{imageCount}/{MAX_IMAGES_PER_SESSION} {s.chat.images[lang]}</span>
            )}
          </div>
        </div>
      </div>

      {/* Booking Modals */}
      {bookingStep === 'slot-picker' && selectedDoctor && (
        <SlotPicker
          doctorId={selectedDoctor.id}
          doctorNameAr={selectedDoctor.nameAr}
          onSelectSlot={handleSelectSlot}
          onClose={() => setBookingStep('none')}
        />
      )}

      {bookingStep === 'patient-form' && (
        <PatientForm
          onSubmit={handleConfirmBooking}
          onBack={() => setBookingStep('slot-picker')}
          isSubmitting={isBooking}
        />
      )}

      {/* Booking error toast */}
      {bookingError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {bookingError}
          <button onClick={() => setBookingError(null)} className={`${isRtl ? 'mr-2' : 'ml-2'} font-bold`}>✕</button>
        </div>
      )}
    </main>
  );
}
