/**
 * POST /api/phone/recording-status
 * Twilio webhook called when a call recording status changes.
 *
 * When the recording is completed, we save the recording URL
 * to the triage session so it can be reviewed later in the admin panel.
 *
 * Twilio sends these statuses:
 *   - in-progress: Recording has started
 *   - paused: Recording is paused
 *   - stopped: Recording manually stopped
 *   - completed: Recording finished and is available for download
 *   - absent: No audio detected
 *   - failed: Recording failed
 */

import { createServerClient } from '@triaji/shared/supabase';
import { validateTwilioSignature } from '@/lib/phone/twilio';

// ─── Types ──────────────────────────────────────────────────────────────────

type TwilioRecordingStatus =
  | 'in-progress'
  | 'paused'
  | 'stopped'
  | 'completed'
  | 'absent'
  | 'failed';

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // Validate Twilio signature
    const isValid = await validateTwilioSignature(request.clone());
    if (!isValid) {
      console.warn('[Recording] Invalid Twilio signature — rejecting request');
      return new Response('Forbidden', { status: 403 });
    }

    // Parse form data
    const formData = await request.formData();
    const recordingSid = formData.get('RecordingSid') as string | null;
    const recordingUrl = formData.get('RecordingUrl') as string | null;
    const recordingStatus = formData.get('RecordingStatus') as TwilioRecordingStatus | null;
    const recordingDuration = formData.get('RecordingDuration') as string | null;
    const callSid = formData.get('CallSid') as string | null;

    if (!recordingSid || !recordingStatus || !callSid) {
      console.error('[Recording] Missing required fields: RecordingSid, RecordingStatus, or CallSid');
      return new Response('Bad Request', { status: 400 });
    }

    console.log(
      `[Recording] Status update: ${recordingStatus} | call=${callSid} | recording=${recordingSid}`
    );

    // Only process completed recordings
    if (recordingStatus !== 'completed') {
      if (recordingStatus === 'failed') {
        console.error(`[Recording] Recording failed for call ${callSid}`);
      }
      return new Response('OK', { status: 200 });
    }

    if (!recordingUrl) {
      console.error(`[Recording] Completed recording has no URL for call ${callSid}`);
      return new Response('OK', { status: 200 });
    }

    // Twilio recording URLs don't include the file extension by default.
    // Append .mp3 to get the MP3 version (default is WAV).
    const recordingUrlMp3 = `${recordingUrl}.mp3`;
    const durationSeconds = recordingDuration ? parseInt(recordingDuration, 10) : null;

    console.log(
      `[Recording] Saving completed recording: ${recordingUrlMp3} (${durationSeconds ?? '?'}s) for call ${callSid}`
    );

    // Look up the triage session by call_sid and save the recording URL
    const supabase = createServerClient();

    const { data: session, error: lookupError } = await supabase
      .from('triage_sessions')
      .select('id')
      .eq('call_sid', callSid)
      .maybeSingle();

    if (lookupError) {
      console.error(`[Recording] Error looking up session for call ${callSid}:`, lookupError.message);
      return new Response('Internal Server Error', { status: 500 });
    }

    if (!session) {
      console.warn(`[Recording] No triage session found for call_sid=${callSid}`);
      return new Response('OK', { status: 200 });
    }

    // Update the session with the recording URL and duration
    const updatePayload: Record<string, string | number> = {
      recording_url: recordingUrlMp3,
    };

    if (durationSeconds !== null && !isNaN(durationSeconds)) {
      updatePayload.call_duration_seconds = durationSeconds;
    }

    const { error: updateError } = await supabase
      .from('triage_sessions')
      .update(updatePayload)
      .eq('id', session.id);

    if (updateError) {
      console.error(`[Recording] Error updating session ${session.id}:`, updateError.message);
      return new Response('Internal Server Error', { status: 500 });
    }

    console.log(`[Recording] Session ${session.id} updated with recording URL`);

    return new Response('OK', { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Recording] Recording status handler error:', message);
    return new Response('Internal Server Error', { status: 500 });
  }
}
