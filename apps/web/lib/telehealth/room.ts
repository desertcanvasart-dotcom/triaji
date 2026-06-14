import { createServerClient } from '@triaji/shared/supabase';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

function isConfigured(): boolean {
  return !!(LIVEKIT_API_KEY && LIVEKIT_API_SECRET && LIVEKIT_URL);
}

/**
 * Create a LiveKit room for a telehealth booking.
 * In DEV_MODE (no LiveKit credentials), returns a mock room name.
 */
export async function createTelehealthRoom(bookingId: string): Promise<string> {
  const roomName = `triaji-${bookingId}`;
  const supabase = createServerClient();

  if (!isConfigured()) {
    console.log('[Telehealth DEV_MODE] Would create room:', roomName);
    await supabase
      .from('bookings')
      .update({
        livekit_room_name: roomName,
        livekit_room_created_at: new Date().toISOString(),
      })
      .eq('id', bookingId);
    return roomName;
  }

  // Use LiveKit Server SDK REST API to create room
  try {
    const { RoomServiceClient } = await import('livekit-server-sdk');
    const roomService = new RoomServiceClient(
      LIVEKIT_URL!,
      LIVEKIT_API_KEY!,
      LIVEKIT_API_SECRET!
    );

    await roomService.createRoom({
      name: roomName,
      emptyTimeout: 10 * 60,
      maxParticipants: 2,
    });

    await supabase
      .from('bookings')
      .update({
        livekit_room_name: roomName,
        livekit_room_created_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    return roomName;
  } catch (err) {
    console.error('[Telehealth] Failed to create LiveKit room:', err);
    // Still save room name for DEV fallback
    await supabase
      .from('bookings')
      .update({ livekit_room_name: roomName })
      .eq('id', bookingId);
    return roomName;
  }
}

/**
 * Generate an access token for a participant to join a telehealth call.
 * In DEV_MODE, returns a mock token.
 */
export async function generateToken(
  roomName: string,
  participantName: string,
  role: 'patient' | 'doctor'
): Promise<string> {
  if (!isConfigured()) {
    console.log('[Telehealth DEV_MODE] Would generate token for:', participantName, 'room:', roomName);
    return `dev-token-${role}-${Date.now()}`;
  }

  const { AccessToken } = await import('livekit-server-sdk');
  const token = new AccessToken(LIVEKIT_API_KEY!, LIVEKIT_API_SECRET!, {
    identity: `${role}-${participantName}`,
    name: participantName,
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: role === 'doctor',
  });

  return await token.toJwt();
}
