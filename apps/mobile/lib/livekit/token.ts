import { getPatientToken } from '../storage';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Get a LiveKit participant token for a GP video call.
 */
export async function getVideoCallToken(
  roomName: string,
  participantName: string,
  role: 'doctor' | 'patient'
): Promise<string> {
  const token = getPatientToken();

  const response = await fetch(`${API_BASE}/api/telehealth/gp-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ roomName, participantName, role }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get video call token: ${response.status}`);
  }

  const data = await response.json();
  return data.token;
}
