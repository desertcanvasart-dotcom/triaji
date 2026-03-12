'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface ChatMessage {
  id: string;
  role: 'patient' | 'ai';
  content: string;
}

interface ChatResult {
  response: string;
  isEmergency: boolean;
  sessionComplete: boolean;
  specialty?: {
    nameEn: string;
    nameAr: string;
    confidence: number;
    urgency: string;
  };
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
  const [specialty, setSpecialty] = useState<ChatResult['specialty']>(null!);
  const [emergencyInfo, setEmergencyInfo] = useState<ChatResult['emergency']>(null!);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Create session and send initial greeting
  const startSession = useCallback(async () => {
    if (sessionId) return;
    setIsLoading(true);

    try {
      // Create a guest patient for demo (in production, this would be an authenticated user)
      const sessionRes = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: null, // Guest mode
          channel: 'app',
        }),
      });
      const sessionData = (await sessionRes.json()) as { session: { id: string }; error?: string };

      if (!sessionRes.ok || !sessionData.session) {
        throw new Error(sessionData.error ?? 'Failed to create session');
      }

      setSessionId(sessionData.session.id);
      setSessionStatus('active');

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
  }, [sessionId]);

  // Start session on mount
  useEffect(() => {
    startSession();
  }, [startSession]);

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
      } else if (data.sessionComplete && data.specialty) {
        setSessionStatus('completed');
        setSpecialty(data.specialty);
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

          {/* Specialty Result */}
          {sessionStatus === 'completed' && specialty && (
            <div className="bg-teal-50 border-2 border-teal-500 rounded-xl p-4 text-center">
              <p className="text-teal-700 font-bold text-lg mb-2">
                تم تحديد التخصص المناسب
              </p>
              <p className="text-teal-800 text-xl font-bold mb-1">
                {specialty.nameAr}
              </p>
              <p className="text-teal-600 text-sm mb-2">
                ({specialty.nameEn})
              </p>
              <p className="text-gray-600 text-sm">
                درجة الثقة: {(specialty.confidence * 100).toFixed(0)}%
              </p>
              {/* Doctor booking button placeholder — Phase 6 */}
              <button className="mt-4 bg-teal-600 text-white px-6 py-3 rounded-xl font-semibold opacity-50 cursor-not-allowed">
                احجز موعد مع دكتور (قريبًا)
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
