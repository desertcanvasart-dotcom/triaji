/**
 * WebSocket Server for Twilio Media Streams
 *
 * This module creates a WebSocket server that handles real-time audio
 * streaming from Twilio phone calls. It attaches to the Next.js HTTP
 * server via instrumentation.ts (runs once on server start).
 *
 * Architecture:
 *   Twilio -> wss://app.triajji.com/api/phone/stream -> this handler
 *   -> CallSession (STT + Triage + TTS) -> audio back to Twilio
 *
 * Audio format: mulaw 8kHz mono (Twilio default)
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import type { CallEndReason } from '@triaji/shared/types';
import { scheduleCallback } from './callbacks';

// ─── Twilio Media Stream Message Types ──────────────────────────────────────

interface TwilioStartMessage {
  event: 'start';
  start: {
    streamSid: string;
    callSid: string;
    accountSid: string;
    customParameters: Record<string, string>;
  };
  streamSid: string;
}

interface TwilioMediaMessage {
  event: 'media';
  media: {
    payload: string; // base64 mulaw audio
    track: 'inbound' | 'outbound';
    timestamp: string;
    chunk: string;
  };
  streamSid: string;
}

interface TwilioDtmfMessage {
  event: 'dtmf';
  dtmf: {
    digit: string;
    track: string;
  };
  streamSid: string;
}

interface TwilioStopMessage {
  event: 'stop';
  stop: {
    accountSid: string;
    callSid: string;
  };
  streamSid: string;
}

interface TwilioConnectedMessage {
  event: 'connected';
  protocol: string;
  version: string;
}

type TwilioStreamMessage =
  | TwilioConnectedMessage
  | TwilioStartMessage
  | TwilioMediaMessage
  | TwilioDtmfMessage
  | TwilioStopMessage;

// ─── Call Session Interface ─────────────────────────────────────────────────
// Matches the CallSession class from ./call-session.ts

interface PhoneCallSession {
  conversationState: {
    sessionId: string;
    tenantId: string | null;
    callerPhone: string;
    inMenu: boolean;
    inTriage: boolean;
    exchangeCount: number;
    lang: 'ar' | 'en';
    englishEnabled: boolean;
  };
  getGreeting(): string;
  speak(text: string, sendFn: (audio: Buffer) => void): Promise<void>;
  onAudioChunk(audio: Buffer): Promise<void>;
  onDTMF(digit: string): Promise<void>;
  end(reason: CallEndReason): Promise<void>;
}

// ─── Active Sessions Map ────────────────────────────────────────────────────

const activeSessions = new Map<string, PhoneCallSession>();

/**
 * Get an active call session by Twilio Stream SID.
 */
export function getActiveSession(streamSid: string): PhoneCallSession | undefined {
  return activeSessions.get(streamSid);
}

/**
 * Get count of active sessions (for monitoring).
 */
export function getActiveSessionCount(): number {
  return activeSessions.size;
}

// ─── WebSocket Upgrade Handler ──────────────────────────────────────────────

const STREAM_PATH = '/api/phone/stream';

/**
 * Handle HTTP -> WebSocket upgrade for Twilio Media Stream connections.
 * Called from instrumentation.ts when the Node.js HTTP server receives
 * an upgrade request on the /api/phone/stream path.
 */
export function handleWebSocketUpgrade(
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer
): void {
  const url = request.url ?? '';

  // Only handle our stream path
  if (!url.startsWith(STREAM_PATH)) return;

  const wss = new WebSocketServer({ noServer: true });

  wss.handleUpgrade(request, socket, head, (ws) => {
    console.log('[Phone WS] New Twilio Media Stream connection');
    handleTwilioStream(ws);
  });
}

// ─── Stream Handler ─────────────────────────────────────────────────────────

/** Timeout in ms to wait for initial DTMF menu input before defaulting to voice triage */
const MENU_TIMEOUT_MS = 10_000;

/** Timeout in ms to wait for any audio before prompting */
const NO_AUDIO_TIMEOUT_MS = 15_000;

/** Timeout in ms to wait after "are you there?" prompt before ending call */
const NO_AUDIO_FINAL_TIMEOUT_MS = 5_000;

async function handleTwilioStream(ws: WebSocket): Promise<void> {
  let streamSid = '';
  let callSession: PhoneCallSession | null = null;
  let menuTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let noAudioTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let noAudioFinalTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let receivedAudio = false;
  let sessionEnded = false;

  ws.on('message', async (data) => {
    try {
      const raw = data.toString();
      const msg = JSON.parse(raw) as TwilioStreamMessage;

      switch (msg.event) {
        case 'connected': {
          console.log('[Phone WS] Twilio stream connected');
          break;
        }

        case 'start': {
          const startMsg = msg as TwilioStartMessage;
          streamSid = startMsg.start.streamSid;
          const params = startMsg.start.customParameters;
          const sessionId = params['sessionId'] ?? '';
          const tenantId = params['tenantId'] ?? '';
          const callerPhone = params['callerPhone'] ?? '';
          const callSid = params['callSid'] ?? '';
          const callbackGreeting = params['callbackGreeting'] ?? '';
          const englishEnabled = params['englishEnabled'] === 'true';

          console.log(
            `[Phone WS] Stream started: ${streamSid} | session=${sessionId} | call=${callSid}${callbackGreeting ? ' (callback)' : ''}${englishEnabled ? ' (bilingual)' : ''}`
          );

          // Dynamically import CallSession to avoid circular dependencies
          const { CallSession } = await import('./call-session');
          callSession = new CallSession(
            sessionId,
            tenantId || null,
            callSid,
            streamSid,
            callerPhone,
            englishEnabled
          );
          activeSessions.set(streamSid, callSession);

          // Play greeting — use callback greeting if this is a callback call
          if (callbackGreeting) {
            // Callback call: skip IVR menu, go straight to triage
            await callSession.speak(callbackGreeting, (audio: Buffer) => {
              sendAudioToTwilio(ws, streamSid, audio);
            });
            // Auto-enter triage mode (simulate pressing 1)
            await callSession.onDTMF('1');
          } else {
            // Normal call: play standard IVR greeting
            const greeting = callSession.getGreeting();
            await callSession.speak(greeting, (audio: Buffer) => {
              sendAudioToTwilio(ws, streamSid, audio);
            });
          }

          // Set timeout: if no DTMF input within 10s, default to voice triage (digit 1)
          menuTimeoutId = setTimeout(() => {
            if (callSession && callSession.conversationState.inMenu) {
              console.log(`[Phone WS] Menu timeout for stream ${streamSid} — defaulting to voice triage`);
              callSession.onDTMF('1').catch((err: unknown) => {
                const errMsg = err instanceof Error ? err.message : 'Unknown error';
                console.error('[Phone WS] Menu timeout DTMF error:', errMsg);
              });
            }
          }, MENU_TIMEOUT_MS);

          // Trigger 2: No-audio detection — if no audio received for 15s after greeting
          // Capture session reference for use in timeout closures
          const sessionRef = callSession;
          noAudioTimeoutId = setTimeout(() => {
            if (!receivedAudio && sessionRef && !sessionEnded) {
              console.log(`[Phone WS] No audio for ${NO_AUDIO_TIMEOUT_MS / 1000}s — prompting patient`);
              const sessionLang = sessionRef.conversationState.lang;
              const promptMsg = sessionLang === 'en'
                ? 'Are you there? If you need help, please speak now.'
                : 'هل أنت موجود؟ لو محتاج مساعدة اتكلم دلوقتي.';
              sessionRef.speak(promptMsg, (audio: Buffer) => {
                sendAudioToTwilio(ws, streamSid, audio);
              }).catch((err: unknown) => {
                console.error('[Phone WS] No-audio prompt error:', err);
              });

              // If still no audio after 5 more seconds, end call and schedule callback
              noAudioFinalTimeoutId = setTimeout(async () => {
                if (!receivedAudio && !sessionEnded) {
                  console.log(`[Phone WS] Still no audio after prompt — ending call and scheduling callback`);
                  sessionEnded = true;

                  const state = sessionRef.conversationState;
                  await sessionRef.end('patient_hung_up');
                  activeSessions.delete(streamSid);

                  // Schedule callback for no-audio
                  await scheduleCallback({
                    tenantId: state.tenantId,
                    patientPhone: state.callerPhone,
                    originalSessionId: state.sessionId,
                    triggerReason: 'no_audio',
                    scheduledFor: new Date(Date.now() + 5 * 60 * 1000),
                  }).catch((cbErr: unknown) => {
                    console.error('[Phone WS] Failed to schedule no-audio callback:', cbErr);
                  });
                }
              }, NO_AUDIO_FINAL_TIMEOUT_MS);
            }
          }, NO_AUDIO_TIMEOUT_MS);

          break;
        }

        case 'media': {
          if (!callSession) break;

          // Mark that we received audio (clears no-audio detection)
          if (!receivedAudio) {
            receivedAudio = true;
            if (noAudioTimeoutId) {
              clearTimeout(noAudioTimeoutId);
              noAudioTimeoutId = null;
            }
            if (noAudioFinalTimeoutId) {
              clearTimeout(noAudioFinalTimeoutId);
              noAudioFinalTimeoutId = null;
            }
          }

          const mediaMsg = msg as TwilioMediaMessage;
          const audio = Buffer.from(mediaMsg.media.payload, 'base64');
          await callSession.onAudioChunk(audio);
          break;
        }

        case 'dtmf': {
          if (!callSession) break;
          const dtmfMsg = msg as TwilioDtmfMessage;
          console.log(`[Phone WS] DTMF digit received: ${dtmfMsg.dtmf.digit}`);

          // Clear menu timeout if patient pressed a key
          if (menuTimeoutId) {
            clearTimeout(menuTimeoutId);
            menuTimeoutId = null;
          }

          await callSession.onDTMF(dtmfMsg.dtmf.digit);
          break;
        }

        case 'stop': {
          console.log(`[Phone WS] Stream stopped: ${streamSid}`);
          if (callSession && !sessionEnded) {
            sessionEnded = true;
            const state = callSession.conversationState;
            await callSession.end('patient_hung_up');
            activeSessions.delete(streamSid);

            // Trigger 1: Schedule callback if session was incomplete
            // Only if patient was in triage (not just in menu) and had at least 1 exchange
            if (state.inTriage && state.exchangeCount > 0) {
              await scheduleCallback({
                tenantId: state.tenantId,
                patientPhone: state.callerPhone,
                originalSessionId: state.sessionId,
                triggerReason: 'incomplete_session',
                scheduledFor: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
              }).catch((err) => {
                console.error('[Phone WS] Failed to schedule incomplete callback:', err);
              });
            }
          }
          // Clear all timers
          if (menuTimeoutId) {
            clearTimeout(menuTimeoutId);
            menuTimeoutId = null;
          }
          if (noAudioTimeoutId) {
            clearTimeout(noAudioTimeoutId);
            noAudioTimeoutId = null;
          }
          if (noAudioFinalTimeoutId) {
            clearTimeout(noAudioFinalTimeoutId);
            noAudioFinalTimeoutId = null;
          }
          break;
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[Phone WS] Message handling error (stream=${streamSid}):`, errMsg);
    }
  });

  ws.on('close', async () => {
    console.log(`[Phone WS] Connection closed: ${streamSid || 'unknown'}`);
    if (callSession && !sessionEnded) {
      sessionEnded = true;
      try {
        await callSession.end('patient_hung_up');
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[Phone WS] Error ending session on close:', errMsg);
      }
      activeSessions.delete(streamSid);
    }
    if (menuTimeoutId) {
      clearTimeout(menuTimeoutId);
      menuTimeoutId = null;
    }
    if (noAudioTimeoutId) {
      clearTimeout(noAudioTimeoutId);
      noAudioTimeoutId = null;
    }
    if (noAudioFinalTimeoutId) {
      clearTimeout(noAudioFinalTimeoutId);
      noAudioFinalTimeoutId = null;
    }
  });

  ws.on('error', (err) => {
    console.error(`[Phone WS] WebSocket error (stream=${streamSid}):`, err.message);
  });
}

// ─── Twilio Audio Helpers ───────────────────────────────────────────────────

/**
 * Send base64-encoded audio back to Twilio via the Media Stream WebSocket.
 * Audio must be mulaw 8kHz mono to match Twilio's expected format.
 */
function sendAudioToTwilio(ws: WebSocket, streamSid: string, audio: Buffer): void {
  if (ws.readyState !== WebSocket.OPEN) return;

  ws.send(
    JSON.stringify({
      event: 'media',
      streamSid,
      media: {
        payload: audio.toString('base64'),
      },
    })
  );
}

/**
 * Clear the audio buffer on the Twilio side (e.g., to interrupt playback
 * when the patient starts speaking). Sends a 'clear' event.
 */
export function clearTwilioAudioBuffer(ws: WebSocket, streamSid: string): void {
  if (ws.readyState !== WebSocket.OPEN) return;

  ws.send(
    JSON.stringify({
      event: 'clear',
      streamSid,
    })
  );
}

/**
 * Send a mark event to Twilio for tracking playback position.
 * Useful for knowing when specific audio segments finish playing.
 */
export function sendTwilioMark(ws: WebSocket, streamSid: string, markName: string): void {
  if (ws.readyState !== WebSocket.OPEN) return;

  ws.send(
    JSON.stringify({
      event: 'mark',
      streamSid,
      mark: {
        name: markName,
      },
    })
  );
}
