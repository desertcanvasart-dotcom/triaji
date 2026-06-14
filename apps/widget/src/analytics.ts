import type { WidgetEventType } from './config';

/**
 * Fire-and-forget analytics event.
 * Never blocks UI, never throws.
 */
export function trackEvent(
  apiUrl: string,
  tenantId: string,
  eventType: WidgetEventType,
  sessionId?: string
): void {
  fetch(`${apiUrl}/api/embed/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId,
      eventType,
      sessionId: sessionId ?? null,
      pageUrl: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
    }),
    keepalive: true,
  }).catch(() => {
    // Never throw — analytics must not break the widget
  });
}
