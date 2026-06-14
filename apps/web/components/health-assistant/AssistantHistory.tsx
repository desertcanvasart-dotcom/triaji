'use client';

import { useState, useEffect } from 'react';
import { t, type Lang } from '@triaji/shared/i18n';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SessionEntry {
  id: string;
  firstMessage: string;
  messageCount: number;
  date: string;
  lastMessageAt: string;
  lang: string;
  escalated: boolean;
}

interface AssistantHistoryProps {
  lang: Lang;
  onLoadSession: (sessionId: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AssistantHistory({ lang, onLoadSession }: AssistantHistoryProps) {
  const isRtl = lang === 'ar';
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/health-assistant/sessions', { credentials: 'include' });
        if (res.ok) {
          const data = (await res.json()) as { sessions: SessionEntry[] };
          setSessions(data.sessions ?? []);
        }
      } catch {
        // Silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return date.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      if (diffDays === 1) {
        return lang === 'ar' ? 'أمبارح' : 'Yesterday';
      }
      if (diffDays < 7) {
        return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
          weekday: 'long',
        });
      }
      return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  // Filter to last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentSessions = sessions.filter(
    (s) => new Date(s.date).getTime() >= thirtyDaysAgo.getTime()
  );

  return (
    <div className="h-full flex flex-col" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-bold text-gray-700">
          {t('healthAssistant.history', lang)}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-400 text-sm animate-pulse">
              {t('common.loading', lang)}
            </div>
          </div>
        ) : recentSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="text-3xl mb-2">💬</div>
            <p className="text-sm text-gray-400">
              {t('healthAssistant.noHistory', lang)}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onLoadSession(session.id)}
                className="w-full text-start px-4 py-3 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">
                    {formatDate(session.date)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {session.messageCount} {t('healthAssistant.messagesCount', lang)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">
                  {session.firstMessage || '...'}
                </p>
                {session.escalated && (
                  <span className="inline-block mt-1 text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                    ⚠
                  </span>
                )}
                <span className="text-xs text-teal-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity mt-1 block">
                  {t('healthAssistant.openSession', lang)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
