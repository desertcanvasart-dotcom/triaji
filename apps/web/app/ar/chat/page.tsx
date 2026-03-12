'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { DoctorRecommendation, MatchedDoctor } from '@triaji/shared/types';
import DoctorList from '@/components/booking/DoctorList';
import SlotPicker from '@/components/booking/SlotPicker';
import PatientForm from '@/components/booking/PatientForm';
import BookingConfirmation from '@/components/booking/BookingConfirmation';

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

const MAX_IMAGES_PER_SESSION = 3;

export default function ChatPage() {
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      () => {},
      { enableHighAccuracy: false, timeout: 5000 }
    );
  }, []);

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
        content: 'أهلًا بيك في تريجي! أنا مرشد طبي ذكي هساعدك توصل للتخصص المناسب.\n\nقولي إيه اللي حاسس بيه أو إيه اللي بيوجعك؟\n\n📷 تقدر ترفع صور لو عندك أعراض ظاهرة.',
      }]);
    } catch (err) {
      console.error('Failed to start session:', err);
      setMessages([{
        id: 'error',
        role: 'ai',
        content: 'حصل مشكلة في بدء المحادثة. حاول تاني.',
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [updateSessionLocation]);

  useEffect(() => {
    startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Image handling
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = MAX_IMAGES_PER_SESSION - imageCount - pendingImages.length;
    if (remaining <= 0) {
      alert('لا يمكن إرسال أكثر من 3 صور في المحادثة');
      return;
    }

    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const file = files[i];
      if (!file) continue;

      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        alert('يُسمح فقط بصور JPEG أو PNG أو WEBP');
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('الصورة أكبر من 10 ميجابايت، من فضلك اختر صورة أصغر');
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
        const errorMsg = err instanceof Error ? err.message : 'حدث خطأ في رفع الصورة، حاول مرة أخرى';
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
      content: text || '📷 صورة مرفقة',
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    };
    setMessages((prev) => [...prev, patientMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: text || 'المريض أرسل صورة للأعراض',
          imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
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
      const errorMsg = err instanceof Error ? err.message : 'خطأ غير معروف';
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`,
        role: 'ai',
        content: `حصل خطأ: ${errorMsg}. حاول تاني.`,
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Booking flow handlers
  const handleBookDoctor = (doctor: MatchedDoctor) => {
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
        setBookingError(result.error ?? 'هذا الميعاد تم حجزه، اختر ميعاد آخر.');
        setBookingStep('slot-picker');
        return;
      }

      if (!res.ok) {
        throw new Error(result.error ?? 'فشل الحجز');
      }

      setBookingData(result);
      setBookingStep('confirmed');
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'خطأ غير متوقع في الحجز');
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
    <main className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-teal-600 text-white py-4 px-6 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">تريجي</h1>
          <span className="text-sm opacity-80">مرشد طبي ذكي</span>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto chat-scroll">
        <div className="max-w-2xl mx-auto w-full p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'patient' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 whitespace-pre-wrap ${
                  msg.role === 'patient'
                    ? 'bg-teal-600 text-white rounded-br-md'
                    : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md'
                }`}
              >
                {msg.imageUrls && msg.imageUrls.length > 0 && (
                  <div className="flex gap-1 mb-2">
                    <span className="text-xs opacity-70">📷 {msg.imageUrls.length} صورة مرفقة</span>
                  </div>
                )}
                {msg.content}
              </div>
            </div>
          ))}

          {(isLoading || isUploading) && (
            <div className="flex justify-start">
              <div className="bg-white text-gray-400 shadow-sm border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                <span className="animate-pulse">
                  {isUploading ? 'جاري رفع الصورة...' : 'جاري الكتابة...'}
                </span>
              </div>
            </div>
          )}

          {/* Emergency Banner */}
          {sessionStatus === 'escalated' && emergencyInfo && (
            <div className="bg-red-50 border-2 border-red-500 rounded-xl p-4 text-center">
              <p className="text-red-700 font-bold text-lg mb-2">حالة طوارئ</p>
              <p className="text-red-600">{emergencyInfo.instructionsAr}</p>
              <p className="text-red-500 text-sm mt-2">اتصل بالطوارئ فورًا: 123</p>
            </div>
          )}

          {/* Doctor Recommendation */}
          {sessionStatus === 'completed' && recommendation && bookingStep !== 'confirmed' && (
            <DoctorList recommendation={recommendation} onBookDoctor={handleBookDoctor} />
          )}

          {/* Booking Confirmation */}
          {bookingStep === 'confirmed' && bookingData && (
            <BookingConfirmation
              doctorNameAr={bookingData.doctorNameAr}
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
                بدء محادثة جديدة
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
                title={imageCount >= MAX_IMAGES_PER_SESSION ? 'وصلت للحد الأقصى من الصور' : 'إرفاق صورة'}
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

            <input
              ref={inputRef}
              type="text"
              dir="rtl"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                sessionStatus === 'active'
                  ? 'اكتب أعراضك هنا...'
                  : 'المحادثة انتهت'
              }
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-right focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || isUploading || sessionStatus !== 'active'}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || isUploading || (!input.trim() && pendingImages.length === 0) || sessionStatus !== 'active'}
              className="bg-teal-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              إرسال
            </button>
          </div>

          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-400">
              تريجي مرشد طبي ذكي — مش بديل عن الدكتور
            </p>
            {sessionStatus === 'active' && imageCount > 0 && (
              <span className="text-xs text-gray-400 ltr-nums">{imageCount}/{MAX_IMAGES_PER_SESSION} صور</span>
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
          <button onClick={() => setBookingError(null)} className="mr-2 font-bold">✕</button>
        </div>
      )}
    </main>
  );
}
