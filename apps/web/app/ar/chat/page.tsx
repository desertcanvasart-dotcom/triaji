'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { DoctorRecommendation } from '@triaji/shared/types';
import DoctorList from '@/components/booking/DoctorList';

interface ChatMessage {
  id: string;
  role: 'patient' | 'ai';
  content: string;
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

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'active' | 'completed' | 'escalated'>('idle');
  const [recommendation, setRecommendation] = useState<DoctorRecommendation | null>(null);
  const [emergencyInfo, setEmergencyInfo] = useState<ChatResult['emergency'] | undefined>(undefined);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, recommendation, scrollToBottom]);

  /**
   * Send patient geolocation to the session for geo-matching.
   */
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
        // Geolocation denied — fallback to governorate matching
      },
      { enableHighAccuracy: false, timeout: 5000 }
    );
  }, []);

  // Create session and send initial greeting
  const startSession = useCallback(async () => {
    setIsLoading(true);
    setMessages([]);
    setRecommendation(null);
    setEmergencyInfo(undefined);

    try {
      const sessionRes = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: null,
          channel: 'app',
        }),
      });
      const sessionData = (await sessionRes.json()) as { session: { id: string }; error?: string };

      if (!sessionRes.ok || !sessionData.session) {
        throw new Error(sessionData.error ?? 'Failed to create session');
      }

      const newSessionId = sessionData.session.id;
      setSessionId(newSessionId);
      setSessionStatus('active');

      // Request geolocation for doctor matching
      updateSessionLocation(newSessionId);

      // Add AI welcome message
      setMessages([
        {
          id: 'welcome',
          role: 'ai',
          content: 'أهلًا بيك في تريجي! أنا مرشد طبي ذكي هساعدك توصل للتخصص المناسب.\n\nقولي إيه اللي حاسس بيه أو إيه اللي بيوجعك؟',
        },
      ]);
    } catch (err) {
      console.error('Failed to start session:', err);
      setMessages([
        {
          id: 'error',
          role: 'ai',
          content: 'حصل مشكلة في بدء المحادثة. حاول تاني.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [updateSessionLocation]);

  // Start session on mount
  useEffect(() => {
    startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !sessionId || isLoading || sessionStatus !== 'active') return;

    setInput('');
    setIsLoading(true);

    // Add patient message
    const patientMsg: ChatMessage = {
      id: `p-${Date.now()}`,
      role: 'patient',
      content: text,
    };
    setMessages((prev) => [...prev, patientMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text }),
      });
      const data = (await res.json()) as ChatResult & { error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to send message');
      }

      // Add AI response
      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'ai',
        content: data.response,
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Handle session completion
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
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'ai',
          content: `حصل خطأ: ${errorMsg}. حاول تاني.`,
        },
      ]);
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

  const handleNewSession = () => {
    setSessionId(null);
    setSessionStatus('idle');
    startSession();
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
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white text-gray-400 shadow-sm border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                <span className="animate-pulse">جاري الكتابة...</span>
              </div>
            </div>
          )}

          {/* Emergency Banner */}
          {sessionStatus === 'escalated' && emergencyInfo && (
            <div className="bg-red-50 border-2 border-red-500 rounded-xl p-4 text-center">
              <p className="text-red-700 font-bold text-lg mb-2">
                حالة طوارئ
              </p>
              <p className="text-red-600">{emergencyInfo.instructionsAr}</p>
              <p className="text-red-500 text-sm mt-2">
                اتصل بالطوارئ فورًا: 123
              </p>
            </div>
          )}

          {/* Doctor Recommendation */}
          {sessionStatus === 'completed' && recommendation && (
            <DoctorList recommendation={recommendation} />
          )}

          {/* New Session Button */}
          {(sessionStatus === 'completed' || sessionStatus === 'escalated') && (
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
          <div className="flex gap-3">
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
              disabled={isLoading || sessionStatus !== 'active'}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim() || sessionStatus !== 'active'}
              className="bg-teal-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              إرسال
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            تريجي مرشد طبي ذكي — مش بديل عن الدكتور
          </p>
        </div>
      </div>
    </main>
  );
}
