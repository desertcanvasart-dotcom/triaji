import type {
  AvailableSlot,
  BookingResult,
  DoctorRecommendation,
} from './config';

interface ChatResponse {
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

interface SessionResponse {
  session: {
    id: string;
    status: string;
    channel: string;
  };
}

/**
 * Create a new triage session.
 */
export async function createSession(
  apiUrl: string,
  tenantId: string
): Promise<SessionResponse> {
  const res = await fetch(`${apiUrl}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId,
      channel: 'website_widget',
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create session' }));
    throw new Error(err.error ?? 'Failed to create session');
  }

  return res.json();
}

/**
 * Send a chat message in the triage conversation.
 */
export async function sendMessage(
  apiUrl: string,
  sessionId: string,
  message: string
): Promise<ChatResponse> {
  const res = await fetch(`${apiUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to send message' }));
    throw new Error(err.error ?? 'Failed to send message');
  }

  return res.json();
}

/**
 * Fetch available doctor slots.
 */
export async function fetchSlots(
  apiUrl: string,
  doctorId: string,
  days: number = 14
): Promise<AvailableSlot[]> {
  const res = await fetch(
    `${apiUrl}/api/doctors/${doctorId}/slots?days=${days}`
  );

  if (!res.ok) {
    throw new Error('Failed to fetch slots');
  }

  const data = await res.json();
  return data.slots ?? [];
}

/**
 * Create a booking.
 */
export async function createBooking(
  apiUrl: string,
  params: {
    sessionId: string;
    doctorId: string;
    slotId: string;
    patientName: string;
    phoneNumber: string;
    notes?: string;
  }
): Promise<BookingResult> {
  const res = await fetch(`${apiUrl}/api/booking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to book' }));
    throw new Error(err.error ?? 'Failed to book');
  }

  return res.json();
}
