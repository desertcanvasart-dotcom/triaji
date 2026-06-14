'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { VoiceRecorder } from '@/lib/voice/recorder';

interface VoiceButtonProps {
  onTranscription: (text: string) => void;
  disabled: boolean;
}

type VoiceState = 'idle' | 'recording' | 'processing' | 'error';

const MAX_DURATION_MS = 60 * 1000; // 60 seconds
const MIN_DURATION_MS = 1000; // 1 second

export default function VoiceButton({ onTranscription, disabled }: VoiceButtonProps) {
  const [state, setState] = useState<VoiceState>('idle');
  const [duration, setDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSupported = VoiceRecorder.isSupported();

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const showError = useCallback((msg: string) => {
    setState('error');
    setErrorMessage(msg);
    setTimeout(() => {
      setState('idle');
      setErrorMessage('');
    }, 3000);
  }, []);

  const stopRecording = useCallback(async () => {
    cleanup();

    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;

    const elapsed = Date.now() - startTimeRef.current;

    if (elapsed < MIN_DURATION_MS) {
      recorder.cancel();
      showError('التسجيل قصير جداً، حاول مرة أخرى');
      return;
    }

    try {
      const audioBlob = await recorder.stop();
      setState('processing');

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const res = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = (await res.json()) as { text?: string; error?: string };

      if (!res.ok || !data.text) {
        showError(data.error ?? 'لم نتمكن من تفريغ الصوت، حاول مرة أخرى أو اكتب رسالتك');
        return;
      }

      setState('idle');
      onTranscription(data.text);
    } catch {
      showError('لم نتمكن من تفريغ الصوت، حاول مرة أخرى أو اكتب رسالتك');
    }
  }, [cleanup, showError, onTranscription]);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      showError('المتصفح الحالي لا يدعم التسجيل الصوتي');
      return;
    }

    try {
      const recorder = new VoiceRecorder();
      recorderRef.current = recorder;
      await recorder.start();

      startTimeRef.current = Date.now();
      setState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 200);

      // Auto-stop at max duration
      maxTimerRef.current = setTimeout(() => {
        stopRecording();
      }, MAX_DURATION_MS);
    } catch (err) {
      cleanup();
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        showError('يرجى السماح بالوصول إلى الميكروفون في إعدادات المتصفح');
      } else {
        showError('المتصفح الحالي لا يدعم التسجيل الصوتي');
      }
    }
  }, [isSupported, showError, cleanup, stopRecording]);

  const cancelRecording = useCallback(() => {
    cleanup();
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setState('idle');
  }, [cleanup]);

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  if (!isSupported) return null;

  if (state === 'error') {
    return (
      <div className="text-xs text-red-500 bg-red-50 px-3 py-1.5 rounded-lg">
        {errorMessage}
      </div>
    );
  }

  if (state === 'processing') {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        <span>جارٍ التفريغ...</span>
      </div>
    );
  }

  if (state === 'recording') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        <span className="text-sm text-red-600 font-medium ltr-nums">
          {formatDuration(duration)}
        </span>
        <span className="text-xs text-gray-500">جارٍ التسجيل...</span>
        <button
          type="button"
          onClick={stopRecording}
          className="bg-teal-600 text-white px-3 py-1 rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors"
        >
          إيقاف
        </button>
        <button
          type="button"
          onClick={cancelRecording}
          className="text-gray-400 hover:text-red-500 transition-colors text-sm"
        >
          إلغاء
        </button>
      </div>
    );
  }

  // Idle state
  return (
    <button
      type="button"
      onClick={startRecording}
      disabled={disabled}
      className="text-teal-600 hover:text-teal-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed p-1"
      title="تسجيل صوتي"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-6 h-6"
      >
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>
    </button>
  );
}
