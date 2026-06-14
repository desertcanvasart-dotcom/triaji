import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  primaryColor: string;
  apiBaseUrl?: string;
}

type VoiceState = 'idle' | 'recording' | 'processing' | 'error';

const MAX_DURATION_MS = 60 * 1000;
const MIN_DURATION_MS = 1000;

function isRecordingSupported(): boolean {
  return !!(
    typeof window !== 'undefined' &&
    navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}

export function ChatInput({ onSend, disabled, primaryColor, apiBaseUrl = '' }: ChatInputProps) {
  const [text, setText] = useState('');
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [duration, setDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasVoice = isRecordingSupported();

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const showError = useCallback((msg: string) => {
    setVoiceState('error');
    setErrorMsg(msg);
    setTimeout(() => { setVoiceState('idle'); setErrorMsg(''); }, 3000);
  }, []);

  const stopRecording = useCallback(async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    const elapsed = Date.now() - startTimeRef.current;

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }));
      };
      recorder.stop();
    });

    cleanup();

    if (elapsed < MIN_DURATION_MS) {
      showError('التسجيل قصير جداً، حاول مرة أخرى');
      return;
    }

    setVoiceState('processing');

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const res = await fetch(`${apiBaseUrl}/api/voice/transcribe`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json() as { text?: string; error?: string };

      if (!res.ok || !data.text) {
        showError(data.error ?? 'لم نتمكن من تفريغ الصوت');
        return;
      }

      setText((prev) => {
        const prefix = prev.trim() ? prev.trim() + ' ' : '';
        return prefix + data.text;
      });
      setVoiceState('idle');
      inputRef.current?.focus();
    } catch {
      showError('لم نتمكن من تفريغ الصوت');
    }
  }, [cleanup, showError, apiBaseUrl]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mimeType = mimeTypes.find((t) => MediaRecorder.isTypeSupported(t)) ?? 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(100);
      startTimeRef.current = Date.now();
      setVoiceState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 200);

      maxTimerRef.current = setTimeout(() => stopRecording(), MAX_DURATION_MS);
    } catch (err) {
      cleanup();
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        showError('يرجى السماح بالوصول إلى الميكروفون');
      } else {
        showError('المتصفح لا يدعم التسجيل الصوتي');
      }
    }
  }, [cleanup, showError, stopRecording]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setText('');
    }
  }

  const formatDuration = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <form className="triaji-input-area" onSubmit={handleSubmit}>
      {voiceState === 'error' && (
        <div style={{ fontSize: '11px', color: '#ef4444', padding: '4px 8px', background: '#fef2f2', borderRadius: '6px', marginBottom: '4px', width: '100%' }}>
          {errorMsg}
        </div>
      )}
      {voiceState === 'recording' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', marginBottom: '4px' }}>
          <div style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%', animation: 'pulse 1s infinite' }} />
          <span style={{ fontSize: '13px', color: '#ef4444', fontFamily: 'monospace' }}>{formatDuration(duration)}</span>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>جارٍ التسجيل...</span>
          <button type="button" onClick={stopRecording} style={{ background: primaryColor, color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>إيقاف</button>
          <button type="button" onClick={() => { cleanup(); setVoiceState('idle'); }} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '12px', cursor: 'pointer' }}>إلغاء</button>
        </div>
      )}
      {voiceState === 'processing' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', marginBottom: '4px' }}>
          <div style={{ width: '16px', height: '16px', border: `2px solid ${primaryColor}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '12px', color: '#6b7280' }}>جارٍ التفريغ...</span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
        {hasVoice && voiceState === 'idle' && (
          <button
            type="button"
            onClick={startRecording}
            disabled={disabled}
            className="triaji-voice-btn"
            style={{ background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.3 : 1, padding: '4px', color: primaryColor, display: 'flex', alignItems: 'center' }}
            aria-label="تسجيل صوتي"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </button>
        )}
        <input
          ref={inputRef}
          type="text"
          className="triaji-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="اكتب رسالتك..."
          disabled={disabled || voiceState !== 'idle'}
          autoComplete="off"
          dir="rtl"
        />
        <button
          type="submit"
          className="triaji-send-btn"
          disabled={disabled || !text.trim() || voiceState !== 'idle'}
          style={{ backgroundColor: primaryColor }}
          aria-label="إرسال"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </form>
  );
}
