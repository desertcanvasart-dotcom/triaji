'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { s, type Lang } from '@triaji/shared/i18n';

type TelehealthState = 'loading' | 'waiting' | 'precall' | 'incall' | 'postcall' | 'error';

interface BookingInfo {
  doctorNameAr: string;
  appointmentDatetime: string;
  roomName: string;
  patientId: string;
}

interface TelehealthClientProps {
  bookingId: string;
  lang: Lang;
}

export default function TelehealthClient({ bookingId, lang }: TelehealthClientProps) {
  const [state, setState] = useState<TelehealthState>('loading');
  const [bookingInfo, setBookingInfo] = useState<BookingInfo | null>(null);
  const [countdown, setCountdown] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [consentGiven, setConsentGiven] = useState(false);
  const [cameraOk, setCameraOk] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const [rating, setRating] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load booking info
  useEffect(() => {
    async function loadBooking() {
      try {
        const res = await fetch(`/api/telehealth/token?bookingId=${bookingId}&role=patient`);
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          setErrorMsg(data.error ?? s.common.error[lang]);
          setState('error');
          return;
        }

        // Also fetch booking details
        const bookingRes = await fetch(`/api/booking/${bookingId}`);
        if (bookingRes.ok) {
          const bookingData = (await bookingRes.json()) as {
            booking?: {
              doctor_name_ar?: string;
              appointment_datetime?: string;
              livekit_room_name?: string;
              patient_id?: string;
            };
          };
          const b = bookingData.booking;
          if (b) {
            setBookingInfo({
              doctorNameAr: b.doctor_name_ar ?? '\u0627\u0644\u062F\u0643\u062A\u0648\u0631',
              appointmentDatetime: b.appointment_datetime ?? '',
              roomName: b.livekit_room_name ?? `triaji-${bookingId}`,
              patientId: b.patient_id ?? '',
            });
          }
        }

        // Determine if we should show waiting room or go to precall
        setState('waiting');
      } catch {
        setErrorMsg(s.common.error[lang]);
        setState('error');
      }
    }
    loadBooking();
  }, [bookingId, lang]);

  // Countdown timer
  useEffect(() => {
    if (state !== 'waiting' || !bookingInfo?.appointmentDatetime) return;

    const interval = setInterval(() => {
      const appointmentTime = new Date(bookingInfo.appointmentDatetime).getTime();
      const diff = appointmentTime - Date.now();

      if (diff <= 0) {
        setCountdown(lang === 'ar' ? '\u062D\u0627\u0646 \u0627\u0644\u0648\u0642\u062A!' : "It's time!");
      } else {
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const remainMinutes = minutes % 60;
        if (lang === 'ar') {
          if (hours > 0) {
            setCountdown(`${hours} \u0633\u0627\u0639\u0629 \u0648 ${remainMinutes} \u062F\u0642\u064A\u0642\u0629`);
          } else {
            setCountdown(`${remainMinutes} \u062F\u0642\u064A\u0642\u0629`);
          }
        } else {
          if (hours > 0) {
            setCountdown(`${hours} hour${hours > 1 ? 's' : ''} and ${remainMinutes} minute${remainMinutes !== 1 ? 's' : ''}`);
          } else {
            setCountdown(`${remainMinutes} minute${remainMinutes !== 1 ? 's' : ''}`);
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state, bookingInfo, lang]);

  // Camera/mic test
  const testDevices = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraOk(true);
      setMicOk(true);
    } catch {
      setCameraOk(false);
      setMicOk(false);
    }
  }, []);

  const stopPreview = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Start call
  const joinCall = useCallback(async () => {
    stopPreview();
    setState('incall');

    // Notify server that call started
    await fetch('/api/telehealth/call-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, event: 'call_started' }),
    });

    // Log consent
    if (bookingInfo) {
      await fetch('/api/telehealth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          patientId: bookingInfo.patientId,
          consentedToRecord: consentGiven,
        }),
      });
    }

    // Start duration counter
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  }, [bookingId, bookingInfo, consentGiven, stopPreview]);

  // End call
  const endCall = useCallback(async () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    await fetch('/api/telehealth/call-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, event: 'call_ended' }),
    });

    setState('postcall');
  }, [bookingId]);

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${m}:${String(secs).padStart(2, '0')}`;
  };

  // Error state
  if (state === 'error') {
    return (
      <main className="min-h-screen flex flex-col bg-gray-50">
        <header className="bg-teal-600 text-white py-4 px-6 shadow-md">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-xl font-bold">{s.telehealth.header[lang]}</h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center max-w-md">
            <div className="text-5xl mb-4">&#9888;&#65039;</div>
            <p className="text-gray-700 mb-4">{errorMsg}</p>
            <Link href={`/${lang}`} className="text-teal-600 font-medium hover:underline">
              {s.telehealth.returnHome[lang]}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Loading state
  if (state === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 animate-pulse">{s.common.loading[lang]}</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 text-white py-3 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold">{s.telehealth.header[lang]}</h1>
          {state === 'incall' && (
            <span className="text-sm font-mono text-red-400 ltr-nums">
              {formatDuration(callDuration)}
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        {/* Waiting Room */}
        {state === 'waiting' && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md w-full">
            <div className="w-20 h-20 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 text-teal-600">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {bookingInfo?.doctorNameAr ?? '\u0627\u0644\u062F\u0643\u062A\u0648\u0631'}
            </h2>
            <p className="text-gray-500 mb-6">
              {lang === 'ar'
                ? `\u0627\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u0629 \u062A\u0628\u062F\u0623 \u0628\u0639\u062F ${countdown}`
                : `Consultation starts in ${countdown}`}
            </p>

            <button
              onClick={() => { setState('precall'); testDevices(); }}
              className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors"
            >
              {s.telehealth.readyToJoin[lang]}
            </button>
          </div>
        )}

        {/* Pre-call Checks */}
        {state === 'precall' && (
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">
              {s.telehealth.testCameraAndMic[lang]}
            </h2>

            {/* Camera preview */}
            <div className="bg-gray-900 rounded-xl overflow-hidden mb-4 aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2">
                <span className={cameraOk ? 'text-green-500' : 'text-red-500'}>
                  {cameraOk ? '\u2713' : '\u2717'}
                </span>
                <span className="text-sm text-gray-700">{s.telehealth.camera[lang]}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={micOk ? 'text-green-500' : 'text-red-500'}>
                  {micOk ? '\u2713' : '\u2717'}
                </span>
                <span className="text-sm text-gray-700">{s.telehealth.microphone[lang]}</span>
              </div>
            </div>

            {/* Recording consent */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <p className="text-sm text-gray-700 mb-2">
                {s.telehealth.recordingConsent[lang]}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConsentGiven(true)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    consentGiven
                      ? 'bg-teal-600 text-white'
                      : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s.telehealth.agree[lang]}
                </button>
                <button
                  onClick={() => setConsentGiven(false)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    !consentGiven
                      ? 'bg-gray-600 text-white'
                      : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s.telehealth.disagree[lang]}
                </button>
              </div>
            </div>

            <button
              onClick={joinCall}
              disabled={!cameraOk || !micOk}
              className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {s.telehealth.joinConsultation[lang]}
            </button>
          </div>
        )}

        {/* In-call View */}
        {state === 'incall' && (
          <div className="w-full max-w-4xl">
            {/* Main video area */}
            <div className="bg-gray-800 rounded-2xl overflow-hidden aspect-video mb-4 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 text-gray-400">
                    <path d="M23 7l-7 5 7 5V7z" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </div>
                <p className="text-lg">
                  {s.telehealth.consultingWith[lang]} {bookingInfo?.doctorNameAr}
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  {lang === 'ar'
                    ? '\u0641\u064A \u0628\u064A\u0626\u0629 \u0627\u0644\u0625\u0646\u062A\u0627\u062C\u060C \u0633\u064A\u0638\u0647\u0631 \u0647\u0646\u0627 \u0641\u064A\u062F\u064A\u0648 LiveKit'
                    : 'In production, LiveKit video will appear here'}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <button className="bg-gray-700 text-white p-4 rounded-full hover:bg-gray-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
                  <path d="M23 7l-7 5 7 5V7z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </button>
              <button className="bg-gray-700 text-white p-4 rounded-full hover:bg-gray-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                </svg>
              </button>
              <button
                onClick={endCall}
                className="bg-red-600 text-white p-4 rounded-full hover:bg-red-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
                  <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Post-call */}
        {state === 'postcall' && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md w-full">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8 text-green-600">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {s.telehealth.thankYou[lang]} {bookingInfo?.doctorNameAr}
            </h2>
            <p className="text-gray-500 mb-4">
              {s.telehealth.consultationDuration[lang]} {formatDuration(callDuration)}
            </p>

            {/* Rating */}
            <div className="mb-6">
              <p className="text-sm text-gray-700 mb-2">{s.telehealth.rateConsultation[lang]}</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className={`text-3xl transition-colors ${
                      star <= rating ? 'text-amber-400' : 'text-gray-300'
                    }`}
                  >
                    &#9733;
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <a
                href={`/${lang}/chat`}
                className="block w-full bg-teal-600 text-white py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors"
              >
                {s.telehealth.bookFollowUp[lang]}
              </a>
              <a
                href={`/${lang}`}
                className="block w-full text-gray-500 py-2 font-medium hover:text-gray-700 transition-colors"
              >
                {s.telehealth.returnHome[lang]}
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
