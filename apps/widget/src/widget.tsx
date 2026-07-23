import React, { useState, useCallback, useRef, useEffect } from 'react';
import type {
  TenantConfig,
  UserConfig,
  WidgetView,
  WidgetMessage,
  MatchedDoctor,
  AvailableSlot,
  DoctorRecommendation,
  BookingResult,
} from './config';
import { getPrimaryColor, getApiUrl } from './config';
import { trackEvent } from './analytics';
import { createSession, sendMessage } from './api';
import { ChatMessages } from './chat/ChatMessages';
import { ChatInput } from './chat/ChatInput';
import { EmergencyView } from './chat/EmergencyView';
import { DoctorList } from './booking/DoctorList';
import { SlotPicker } from './booking/SlotPicker';
import { BookingForm } from './booking/BookingForm';
import { Confirmation } from './booking/Confirmation';

interface DoctorTrioWidgetProps {
  tenantConfig: TenantConfig;
  userConfig: UserConfig;
}

let msgCounter = 0;
function nextMsgId(): string {
  return `msg_${++msgCounter}_${Date.now()}`;
}

export function DoctorTrioWidget({ tenantConfig, userConfig }: DoctorTrioWidgetProps) {
  const primaryColor = getPrimaryColor(tenantConfig, userConfig);
  const apiUrl = getApiUrl(userConfig);
  const position = userConfig.position ?? 'bottom-right';
  const posClass = position === 'bottom-left' ? 'left' : 'right';

  // ─── State ─────────────────────────────────────────────────────────
  const [view, setView] = useState<WidgetView>('collapsed');
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSessionCreating, setIsSessionCreating] = useState(false);

  // Emergency state
  const [emergency, setEmergency] = useState<{
    reasonAr: string;
    instructionsAr: string;
  } | null>(null);

  // Doctor recommendation
  const [recommendation, setRecommendation] = useState<DoctorRecommendation | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<MatchedDoctor | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);

  // Pulse animation: only on first visit per page
  const [showPulse, setShowPulse] = useState(() => {
    try {
      return !sessionStorage.getItem('triaji_visited');
    } catch {
      return true;
    }
  });

  // Track first message sent
  const firstMessageSent = useRef(false);

  // ─── Session management ────────────────────────────────────────────

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    if (isSessionCreating) return null;

    setIsSessionCreating(true);
    try {
      const data = await createSession(apiUrl, tenantConfig.tenantId);
      const id = data.session.id;
      setSessionId(id);
      return id;
    } catch (err) {
      console.error('[DoctorTrio] Failed to create session:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: nextMsgId(),
          role: 'ai',
          content: 'عذراً، حدث خطأ في الاتصال. من فضلك حاول مرة أخرى.',
          timestamp: Date.now(),
        },
      ]);
      return null;
    } finally {
      setIsSessionCreating(false);
    }
  }, [sessionId, isSessionCreating, apiUrl, tenantConfig.tenantId]);

  // ─── Handlers ──────────────────────────────────────────────────────

  function handleOpen() {
    setView('chat');
    setShowPulse(false);

    try {
      sessionStorage.setItem('triaji_visited', '1');
    } catch {
      // sessionStorage not available
    }

    trackEvent(apiUrl, tenantConfig.tenantId, 'button_click');

    // Add welcome message if first time
    if (messages.length === 0) {
      setMessages([
        {
          id: nextMsgId(),
          role: 'ai',
          content: tenantConfig.welcomeMessageAr,
          timestamp: Date.now(),
        },
      ]);
    }
  }

  function handleClose() {
    setView('collapsed');
  }

  async function handleSend(text: string) {
    // Add patient message
    setMessages((prev) => [
      ...prev,
      { id: nextMsgId(), role: 'patient', content: text, timestamp: Date.now() },
    ]);

    setIsTyping(true);

    // Ensure session exists
    const sid = await ensureSession();
    if (!sid) {
      setIsTyping(false);
      return;
    }

    // Track first message
    if (!firstMessageSent.current) {
      firstMessageSent.current = true;
      trackEvent(apiUrl, tenantConfig.tenantId, 'session_start', sid);
    }

    try {
      const result = await sendMessage(apiUrl, sid, text);

      // Add AI response
      setMessages((prev) => [
        ...prev,
        { id: nextMsgId(), role: 'ai', content: result.response, timestamp: Date.now() },
      ]);

      // Check for emergency
      if (result.isEmergency && result.emergency) {
        setEmergency({
          reasonAr: result.emergency.reasonAr,
          instructionsAr: result.emergency.instructionsAr,
        });
      }

      // Check for session complete with doctors
      if (result.sessionComplete && result.recommendation) {
        trackEvent(apiUrl, tenantConfig.tenantId, 'session_complete', sid);
        setRecommendation(result.recommendation);
        // Wait a moment then show doctors
        setTimeout(() => {
          setView('doctors');
        }, 1500);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextMsgId(),
          role: 'ai',
          content: 'عذراً، حدث خطأ. من فضلك حاول مرة أخرى.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  function handleSelectDoctor(doctor: MatchedDoctor) {
    setSelectedDoctor(doctor);
    trackEvent(apiUrl, tenantConfig.tenantId, 'booking_started', sessionId ?? undefined);
    setView('slots');
  }

  function handleSelectSlot(slot: AvailableSlot) {
    setSelectedSlot(slot);
    setView('booking-form');
  }

  function handleBookingConfirmed(result: BookingResult) {
    setBookingResult(result);
    setView('confirmed');
  }

  function handleConfirmClose() {
    setView('collapsed');
  }

  // ─── Render ────────────────────────────────────────────────────────

  if (view === 'collapsed') {
    return (
      <button
        className={`triaji-trigger ${posClass} ${showPulse ? 'pulse' : ''}`}
        style={{ backgroundColor: primaryColor }}
        onClick={handleOpen}
        aria-label="ابدأ التوجيه الطبي"
      >
        <svg className="triaji-trigger-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/>
        </svg>
        {userConfig.buttonLabel ?? 'ابدأ الفرز'}
      </button>
    );
  }

  // Panel header (shared across all open views)
  const header = (
    <div className="triaji-header" style={{ backgroundColor: primaryColor }}>
      {tenantConfig.logoUrl && (
        <img
          className="triaji-header-logo"
          src={tenantConfig.logoUrl}
          alt={tenantConfig.nameAr}
        />
      )}
      <span className="triaji-header-title">
        {tenantConfig.nameAr || 'دكتور تريو'}
      </span>
      <button className="triaji-close-btn" onClick={handleClose} aria-label="إغلاق">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );

  return (
    <div
      className={`triaji-panel ${posClass}`}
      style={{ '--triaji-primary': primaryColor } as React.CSSProperties}
    >
      {header}

      {/* Emergency overlay */}
      {emergency && view === 'chat' ? (
        <EmergencyView
          reasonAr={emergency.reasonAr}
          instructionsAr={emergency.instructionsAr}
        />
      ) : view === 'chat' ? (
        <>
          <ChatMessages
            messages={messages}
            isTyping={isTyping}
            primaryColor={primaryColor}
          />
          <ChatInput
            onSend={handleSend}
            disabled={isTyping || isSessionCreating}
            primaryColor={primaryColor}
            apiBaseUrl={apiUrl}
          />
        </>
      ) : view === 'doctors' && recommendation ? (
        <DoctorList
          recommendation={recommendation}
          onSelectDoctor={handleSelectDoctor}
          primaryColor={primaryColor}
        />
      ) : view === 'slots' && selectedDoctor ? (
        <SlotPicker
          apiUrl={apiUrl}
          doctor={selectedDoctor}
          onSelectSlot={handleSelectSlot}
          onBack={() => setView('doctors')}
          primaryColor={primaryColor}
        />
      ) : view === 'booking-form' && selectedDoctor && selectedSlot && sessionId ? (
        <BookingForm
          apiUrl={apiUrl}
          tenantId={tenantConfig.tenantId}
          sessionId={sessionId}
          doctor={selectedDoctor}
          slot={selectedSlot}
          onConfirmed={handleBookingConfirmed}
          onBack={() => setView('slots')}
          primaryColor={primaryColor}
        />
      ) : view === 'confirmed' && bookingResult ? (
        <Confirmation
          result={bookingResult}
          onClose={handleConfirmClose}
          primaryColor={primaryColor}
        />
      ) : (
        <div className="triaji-loading">
          <div className="triaji-spinner" />
        </div>
      )}

      <div className="triaji-powered">
        Powered by <a href="https://doctortrio.online" target="_blank" rel="noopener noreferrer">DoctorTrio</a>
      </div>
    </div>
  );
}
