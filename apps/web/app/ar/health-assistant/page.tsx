'use client';

import { useState } from 'react';
import { t } from '@triaji/shared/i18n';
import AssistantChat from '@/components/health-assistant/AssistantChat';
import AssistantHistory from '@/components/health-assistant/AssistantHistory';
import LanguageToggle from '@/components/shared/LanguageToggle';

export default function ArabicHealthAssistantPage() {
  const lang = 'ar';
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLoadSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setSidebarOpen(false);
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    // Force re-mount by using key
    setKey((k) => k + 1);
  };

  const [key, setKey] = useState(0);

  return (
    <main className="min-h-screen flex flex-col bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-teal-600 text-white py-4 px-6 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="/ar/medical-record"
              className="text-white/70 hover:text-white transition-colors"
              aria-label={t('common.back', lang)}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </a>
            <div>
              <h1 className="text-xl font-bold">{t('healthAssistant.title', lang)}</h1>
              <p className="text-teal-100 text-xs">{t('healthAssistant.subtitle', lang)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleNewChat}
              className="bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-white/30 transition-colors"
            >
              +
            </button>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-white/30 transition-colors lg:hidden"
            >
              {t('healthAssistant.history', lang)}
            </button>
            <LanguageToggle lang={lang} />
          </div>
        </div>
      </header>

      {/* Body: Sidebar + Chat */}
      <div className="flex-1 flex overflow-hidden max-w-4xl mx-auto w-full">
        {/* Sidebar (desktop always, mobile toggle) */}
        <aside
          className={`${
            sidebarOpen ? 'block' : 'hidden'
          } lg:block w-72 border-l border-gray-200 bg-white flex-shrink-0 overflow-hidden`}
        >
          <AssistantHistory lang={lang} onLoadSession={handleLoadSession} />
        </aside>

        {/* Chat */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <AssistantChat
            key={`${key}-${activeSessionId ?? 'new'}`}
            lang={lang}
            initialSessionId={activeSessionId}
          />
        </div>
      </div>
    </main>
  );
}
