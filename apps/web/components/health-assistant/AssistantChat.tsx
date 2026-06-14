'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { t, type Lang } from '@triaji/shared/i18n';
import VoiceButton from '@/components/chat/VoiceButton';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Suggestion {
  id: string;
  text_ar: string;
  text_en: string;
}

interface ContextInfo {
  lastLabDate: string | null;
  lastVisitDate: string | null;
  activeMedsCount: number;
}

interface ThresholdCheckResult {
  eligible: boolean;
  context: ContextInfo | null;
  patientName: string;
}

interface AssistantChatProps {
  lang: Lang;
  initialSessionId?: string | null;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AssistantChat({ lang, initialSessionId }: AssistantChatProps) {
  const isRtl = lang === 'ar';

  // State
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [patientName, setPatientName] = useState('');
  const [contextInfo, setContextInfo] = useState<ContextInfo | null>(null);
  const [contextExpanded, setContextExpanded] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ─── Threshold check ────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/health-assistant/eligibility', { credentials: 'include' });
        if (!res.ok) {
          setEligible(false);
          return;
        }
        const data = (await res.json()) as ThresholdCheckResult;
        setEligible(data.eligible);
        setPatientName(data.patientName ?? '');
        setContextInfo(data.context ?? null);
      } catch {
        setEligible(false);
      }
    })();
  }, []);

  // ─── Fetch suggestions ─────────────────────────────────────────────────

  useEffect(() => {
    if (!eligible || suggestionsLoaded) return;
    (async () => {
      try {
        const res = await fetch('/api/health-assistant/suggestions', { credentials: 'include' });
        if (res.ok) {
          const data = (await res.json()) as { suggestions: Suggestion[] };
          setSuggestions(data.suggestions ?? []);
        }
      } catch {
        // Silent — suggestions are non-critical
      } finally {
        setSuggestionsLoaded(true);
      }
    })();
  }, [eligible, suggestionsLoaded]);

  // ─── Load existing session ─────────────────────────────────────────────

  useEffect(() => {
    if (!initialSessionId) return;
    (async () => {
      try {
        const res = await fetch(`/api/health-assistant/sessions/${initialSessionId}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = (await res.json()) as { messages: ChatMessage[] };
          setMessages(data.messages ?? []);
        }
      } catch {
        // Silent
      }
    })();
  }, [initialSessionId]);

  // ─── Auto-scroll ───────────────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  // ─── Send message with SSE streaming ───────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);
    setStreamingText('');

    try {
      const response = await fetch('/api/health-assistant/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, sessionId, lang }),
      });

      if (!response.ok) {
        throw new Error('Request failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'text') {
                accumulated += data.content;
                setStreamingText(accumulated);
              }
              if (data.type === 'done') {
                if (data.sessionId) setSessionId(data.sessionId);
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }
      }

      // Finalize: move streaming text into messages
      if (accumulated) {
        const aiMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: accumulated,
        };
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: t('common.error', lang),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsStreaming(false);
      setStreamingText('');
      inputRef.current?.focus();
    }
  }, [isStreaming, sessionId, lang]);

  // ─── Keyboard handling ─────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleVoiceTranscription = useCallback((text: string) => {
    setInput(prev => {
      const prefix = prev.trim() ? prev.trim() + ' ' : '';
      return prefix + text;
    });
    inputRef.current?.focus();
  }, []);

  const handleSuggestionClick = (suggestion: Suggestion) => {
    const text = lang === 'ar' ? suggestion.text_ar : suggestion.text_en;
    setInput(text);
    inputRef.current?.focus();
  };

  // ─── Format helpers ────────────────────────────────────────────────────

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '---';
    try {
      return new Date(dateStr).toLocaleDateString(
        lang === 'ar' ? 'ar-EG' : 'en-US',
        { day: 'numeric', month: 'short', year: 'numeric' }
      );
    } catch {
      return dateStr;
    }
  };

  // ─── Render: loading ──────────────────────────────────────────────────

  if (eligible === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">{t('common.loading', lang)}</div>
      </div>
    );
  }

  // ─── Render: empty record ─────────────────────────────────────────────

  if (!eligible) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="text-6xl mb-4">📋</div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">
          {t('healthAssistant.title', lang)}
        </h2>
        <p className="text-sm text-gray-500 max-w-md leading-relaxed">
          {t('healthAssistant.emptyRecord', lang)}
        </p>
        <a
          href={`/${lang}/chat`}
          className="mt-6 bg-teal-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-teal-700 transition-colors"
        >
          {t('home.startTriage', lang)}
        </a>
      </div>
    );
  }

  // ─── Render: chat ─────────────────────────────────────────────────────

  const greeting = t('healthAssistant.greeting', lang).replace('{name}', patientName);
  const hasMessages = messages.length > 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Chat area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full p-4 space-y-4">

          {/* Context awareness banner (collapsible) */}
          {contextInfo && (
            <button
              onClick={() => setContextExpanded(!contextExpanded)}
              className="w-full text-start bg-teal-50 border border-teal-200 rounded-xl p-3 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-teal-700">
                  {t('healthAssistant.contextBanner', lang)}
                </span>
                <span className="text-teal-500 text-xs">
                  {contextExpanded ? '▲' : '▼'}
                </span>
              </div>
              {contextExpanded && (
                <div className="mt-2 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-teal-600 font-medium">
                      {t('healthAssistant.lastLabResults', lang)}
                    </p>
                    <p className="text-sm font-bold text-teal-800">
                      {formatDate(contextInfo.lastLabDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-teal-600 font-medium">
                      {t('healthAssistant.lastVisit', lang)}
                    </p>
                    <p className="text-sm font-bold text-teal-800">
                      {formatDate(contextInfo.lastVisitDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-teal-600 font-medium">
                      {t('healthAssistant.activeMeds', lang)}
                    </p>
                    <p className="text-sm font-bold text-teal-800">
                      {contextInfo.activeMedsCount}
                    </p>
                  </div>
                  <div className="col-span-3 mt-1">
                    <a
                      href={`/${lang}/medical-record`}
                      className="text-xs text-teal-600 underline hover:text-teal-800"
                    >
                      {t('healthAssistant.viewFullRecord', lang)}
                    </a>
                  </div>
                </div>
              )}
            </button>
          )}

          {/* Greeting (shown when no messages) */}
          {!hasMessages && (
            <div className={`${isRtl ? 'text-right' : 'text-left'} py-6`}>
              <h2 className="text-xl font-bold text-gray-800 mb-1">{greeting}</h2>
              <p className="text-sm text-gray-500">
                {t('healthAssistant.greetingSubtitle', lang)}
              </p>
            </div>
          )}

          {/* Suggestion chips */}
          {!hasMessages && suggestions.length > 0 && (
            <div className="pb-2">
              <p className="text-xs text-gray-400 mb-2 font-medium">
                {t('healthAssistant.suggestions', lang)}
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSuggestionClick(s)}
                    className="flex-shrink-0 bg-white border border-teal-200 text-teal-700 text-sm px-4 py-2 rounded-full hover:bg-teal-50 transition-colors whitespace-nowrap"
                  >
                    {lang === 'ar' ? s.text_ar : s.text_en}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? isRtl
                      ? 'bg-teal-600 text-white rounded-br-md'
                      : 'bg-teal-600 text-white rounded-bl-md'
                    : isRtl
                      ? 'bg-gray-100 text-gray-800 rounded-bl-md'
                      : 'bg-gray-100 text-gray-800 rounded-br-md'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Streaming text (active response) */}
          {isStreaming && streamingText && (
            <div className="flex justify-start">
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 whitespace-pre-wrap ${
                  isRtl
                    ? 'bg-gray-100 text-gray-800 rounded-bl-md'
                    : 'bg-gray-100 text-gray-800 rounded-br-md'
                }`}
              >
                {streamingText}
              </div>
            </div>
          )}

          {/* Typing indicator (streaming but no text yet) */}
          {isStreaming && !streamingText && (
            <div className="flex justify-start">
              <div
                className={`rounded-2xl px-4 py-3 ${
                  isRtl ? 'bg-gray-100 rounded-bl-md' : 'bg-gray-100 rounded-br-md'
                }`}
              >
                <div className="flex gap-1.5 items-center h-5">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t bg-white p-4 shadow-inner">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-3 items-end">
            <VoiceButton
              onTranscription={handleVoiceTranscription}
              disabled={isStreaming}
            />

            <textarea
              ref={inputRef}
              dir={isRtl ? 'rtl' : 'ltr'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('healthAssistant.inputPlaceholder', lang)}
              rows={1}
              className={`flex-1 border border-gray-300 rounded-xl px-4 py-3 ${
                isRtl ? 'text-right' : 'text-left'
              } focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none max-h-32 disabled:opacity-50 disabled:cursor-not-allowed`}
              disabled={isStreaming}
              style={{ minHeight: '48px' }}
            />

            <button
              onClick={() => sendMessage(input)}
              disabled={isStreaming || !input.trim()}
              className="bg-teal-600 text-white w-12 h-12 rounded-xl font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
              aria-label={t('healthAssistant.send', lang)}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-2 text-center">
            {t('healthAssistant.disclaimer', lang)}
          </p>
        </div>
      </div>
    </div>
  );
}
