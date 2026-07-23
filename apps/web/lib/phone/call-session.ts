/**
 * Call Session Coordinator
 * The main controller for an active phone call. Ties together all
 * phone subsystems: Deepgram STT, TTS queue, turn detection,
 * DTMF handling, transcript building, and the phone orchestrator.
 *
 * Supports bilingual operation (Arabic + English):
 *   - For english_enabled tenants, Deepgram uses multi-language mode
 *   - Language detected from patient's first utterance
 *   - TTS voice, system prompt, and post-processing adapt to language
 *   - Language locked for entire session after detection
 *
 * Lifecycle:
 * 1. Constructor initializes all subsystems
 * 2. Twilio sends audio chunks → onAudioChunk() → Deepgram
 * 3. Deepgram transcripts → TurnDetector → onPatientTurnComplete()
 * 4. Patient text → PhoneOrchestrator → TTS → Twilio
 * 5. DTMF digits → DTMFHandler → appropriate action
 * 6. Call ends → end() → save transcript + cleanup
 */

import type { CallEndReason } from '@triaji/shared/types';
import { sendWhatsAppMessage } from '@triaji/shared/lib/whatsapp/client';
import { updateSession } from '@/lib/triage/session-manager';

import { createDeepgramStream, type DeepgramConnection } from './deepgram';
import { TTSQueue } from './tts-queue';
import { TurnDetector } from './turn-detector';
import { DTMFHandler, type DTMFAction } from './dtmf-handler';
import { TranscriptBuilder, saveTranscript, saveRecordingUrl } from './transcript';
import {
  handlePhoneMessage,
  PHONE_ERROR_MESSAGE,
  STT_RETRY_MESSAGE,
  STT_FAILURE_MESSAGE,
  HANDOFF_MESSAGE,
  BOOKING_CONFIRMATION,
  type PhoneOrchestratorResult,
} from './phone-orchestrator';
import { initiateHandoff } from './handoff';
import { generateShortRef } from './twilio';
import { PhoneLanguageDetector, type PhoneLanguage } from './language-detector';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PhoneConversationState {
  sessionId: string;
  tenantId: string | null;
  callSid: string;
  streamSid: string;
  callerPhone: string;
  inMenu: boolean;
  inTriage: boolean;
  lastAiResponse: string;
  exchangeCount: number;
  consecutiveSttFailures: number;
  shortRef: string;
  lang: PhoneLanguage;
  englishEnabled: boolean;
}

type TwilioAudioCallback = (audio: Buffer) => void;

// ─── Configuration ──────────────────────────────────────────────────────────

/** Maximum consecutive STT failures before auto-handoff */
const MAX_STT_FAILURES = 3;

/** Handoff trigger phrases in Egyptian Arabic */
const HANDOFF_TRIGGER_PHRASES_AR: readonly string[] = [
  'عايز أتكلم مع حد',
  'كلمني حد',
  'موظف',
  'عايز موظف',
  'إنسان',
  'حد حقيقي',
  'مش فاهم',
  'كلام فاضي',
];

/** Handoff trigger phrases in English */
const HANDOFF_TRIGGER_PHRASES_EN: readonly string[] = [
  'speak to someone',
  'talk to a person',
  'human agent',
  'real person',
  'transfer me',
  'operator',
  "don't understand",
  'not working',
];

// ─── Greeting Messages ─────────────────────────────────────────────────────

const GREETING_MESSAGE =
  'أهلاً بك في دكتور تريو. للتحدث مع المساعد الذكي اضغط واحد. للتحدث مع أحد موظفينا اضغط اثنين. لسماع هذه القائمة مرة أخرى اضغط تسعة.';

const GREETING_MESSAGE_BILINGUAL =
  'أهلاً بك في دكتور تريو. Welcome to DoctorTrio. Please speak in Arabic or English. للتحدث مع المساعد الذكي اضغط واحد. للتحدث مع أحد موظفينا اضغط اثنين.';

const TRIAGE_START_MESSAGE_AR =
  'أهلاً بك، أنا نور، المساعد الطبي الذكي من دكتور تريو. إزاي أقدر أساعدك النهارده؟';

const TRIAGE_START_MESSAGE_EN =
  'Hello, I am Nour, your DoctorTrio medical guide. How can I help you today?';

/** Bilingual language prompt (played when language cannot be detected) */
const LANGUAGE_PROMPT =
  'من فضلك قل لغتك المفضلة — عربي أو إنجليزي. Please say your preferred language — Arabic or English.';

// ─── Call Session ───────────────────────────────────────────────────────────

export class CallSession {
  private state: PhoneConversationState;
  private deepgram: DeepgramConnection;
  private ttsQueue: TTSQueue;
  private turnDetector: TurnDetector;
  private dtmfHandler: DTMFHandler;
  private transcript: TranscriptBuilder;
  private callStartTime: number;
  private turnCheckInterval: ReturnType<typeof setInterval> | null = null;
  private sendToTwilio: TwilioAudioCallback | null = null;
  private languageDetector: PhoneLanguageDetector;
  private languageDetectionAttempted: boolean = false;
  private languagePromptPlayed: boolean = false;

  constructor(
    sessionId: string,
    tenantId: string | null,
    callSid: string,
    streamSid: string,
    callerPhone: string,
    englishEnabled: boolean = false
  ) {
    this.state = {
      sessionId,
      tenantId,
      callSid,
      streamSid,
      callerPhone,
      inMenu: true,
      inTriage: false,
      lastAiResponse: englishEnabled ? GREETING_MESSAGE_BILINGUAL : GREETING_MESSAGE,
      exchangeCount: 0,
      consecutiveSttFailures: 0,
      shortRef: generateShortRef(),
      lang: 'ar', // Default to Arabic, updated after detection
      englishEnabled,
    };

    this.languageDetector = new PhoneLanguageDetector();

    // Use multi-language mode for english-enabled tenants
    this.deepgram = createDeepgramStream({
      multiLanguage: englishEnabled,
    });
    this.ttsQueue = new TTSQueue();
    this.turnDetector = new TurnDetector();
    this.dtmfHandler = new DTMFHandler();
    this.transcript = new TranscriptBuilder();
    this.callStartTime = Date.now();

    // Set up Deepgram event handlers
    this.setupDeepgramListeners();

    // Start turn detection polling
    this.startTurnCheckLoop();

    // Log greeting
    this.transcript.addEntry('ai', this.state.lastAiResponse);
  }

  // ─── Language Management ──────────────────────────────────────────────

  /**
   * Set the session language. Updates TTS voice and internal state.
   * Called after language detection from the patient's first utterance.
   */
  private applyLanguage(lang: PhoneLanguage): void {
    this.state.lang = lang;
    this.ttsQueue.setLanguage(lang);
    console.log(`[CallSession ${this.state.shortRef}] Language set to: ${lang}`);

    // Save detected language to the triage session
    updateSession(this.state.sessionId, {
      detected_lang: lang,
    }).catch((err) => {
      console.error('[CallSession] Failed to save detected_lang:', err);
    });
  }

  /**
   * Get the appropriate handoff trigger phrases for the current language.
   */
  private getHandoffTriggerPhrases(): readonly string[] {
    return this.state.lang === 'en'
      ? HANDOFF_TRIGGER_PHRASES_EN
      : HANDOFF_TRIGGER_PHRASES_AR;
  }

  /**
   * Get the triage start message for the current language.
   */
  private getTriageStartMessage(): string {
    return this.state.lang === 'en'
      ? TRIAGE_START_MESSAGE_EN
      : TRIAGE_START_MESSAGE_AR;
  }

  // ─── Deepgram Event Setup ───────────────────────────────────────────

  private setupDeepgramListeners(): void {
    this.deepgram.on('transcript', (
      text: string,
      isFinal: boolean,
      detectedLanguage?: string,
      languageConfidence?: number
    ) => {
      // Barge-in: if patient starts speaking during AI playback, interrupt
      if (this.ttsQueue.isPlaying) {
        this.ttsQueue.interrupt();
      }

      // Attempt language detection on first final transcript (if english-enabled)
      if (this.state.englishEnabled && !this.languageDetector.isDetected && isFinal) {
        const detected = this.languageDetector.detect(
          text,
          detectedLanguage,
          languageConfidence
        );

        if (detected !== 'unknown') {
          this.applyLanguage(detected);
        } else if (!this.languageDetectionAttempted) {
          // First attempt with unknown result — mark attempted
          this.languageDetectionAttempted = true;
        } else if (!this.languagePromptPlayed) {
          // Second attempt still unknown — play explicit language prompt
          this.languagePromptPlayed = true;
          this.speakIfConnected(LANGUAGE_PROMPT).catch((err) => {
            console.error('[CallSession] Language prompt error:', err);
          });
        }
      }

      this.turnDetector.onTranscript(text, isFinal);
    });

    this.deepgram.on('utterance_end', () => {
      this.turnDetector.onUtteranceEnd();
    });

    this.deepgram.on('error', (err: Error) => {
      console.error(`[CallSession ${this.state.shortRef}] Deepgram error:`, err.message);
    });
  }

  // ─── Turn Check Loop ─────────────────────────────────────────────────

  private startTurnCheckLoop(): void {
    this.turnCheckInterval = setInterval(() => {
      if (this.turnDetector.isComplete()) {
        const text = this.turnDetector.consumeTranscript();
        if (text.length > 0) {
          this.onPatientTurnComplete(text).catch((err) => {
            console.error(`[CallSession ${this.state.shortRef}] Turn processing error:`, err);
          });
        }
      }
    }, 200); // Check every 200ms
  }

  // ─── Audio Input ──────────────────────────────────────────────────────

  /**
   * Called for each audio chunk from Twilio's media stream.
   * Forwards the raw mulaw audio to Deepgram for transcription.
   */
  async onAudioChunk(mulaw: Buffer): Promise<void> {
    this.deepgram.send(mulaw);
  }

  // ─── Patient Turn Complete ────────────────────────────────────────────

  /**
   * Called when the patient's speaking turn is complete.
   * Processes their speech through the triage orchestrator and speaks the response.
   */
  async onPatientTurnComplete(text: string): Promise<void> {
    // Only process if we're in triage mode
    if (!this.state.inTriage) return;

    // Reset STT failure counter on successful transcription
    this.state.consecutiveSttFailures = 0;

    // 1. Log patient text to transcript
    this.transcript.addEntry('patient', text);
    console.log(`[CallSession ${this.state.shortRef}] Patient (${this.state.lang}): "${text.slice(0, 80)}"`);

    // 2. Check for handoff trigger phrases
    const normalizedText = text.trim().toLowerCase();
    const handoffPhrases = this.getHandoffTriggerPhrases();
    const handoffRequested = handoffPhrases.some(
      (phrase) => normalizedText.includes(phrase)
    );

    if (handoffRequested) {
      await this.handleHandoff('patient_request', text);
      return;
    }

    // 3. Send to phone orchestrator (with language)
    let result: PhoneOrchestratorResult;
    try {
      result = await handlePhoneMessage(this.state.sessionId, text, this.state.lang);
    } catch (err) {
      console.error(`[CallSession ${this.state.shortRef}] Orchestrator error:`, err);
      await this.speakIfConnected(PHONE_ERROR_MESSAGE[this.state.lang]);
      return;
    }

    this.state.exchangeCount++;
    this.state.lastAiResponse = result.response;

    // 4. Speak response via TTS
    await this.speakIfConnected(result.response);

    // 5. If emergency → handle emergency flow
    if (result.isEmergency && result.emergency) {
      console.log(`[CallSession ${this.state.shortRef}] Emergency detected:`, result.emergency.escalationType);
      // Emergency instructions are already spoken in the response
      // Send WhatsApp with emergency instructions
      // Note: instructionsAr is used for all languages as instructions are clinically identical
      const emergencyInstructions = result.emergency.instructionsAr;
      await sendWhatsAppMessage(
        this.state.callerPhone,
        `${this.state.lang === 'en' ? 'Emergency alert from DoctorTrio' : 'تنبيه طوارئ من دكتور تريو'}:\n${emergencyInstructions}`
      ).catch((err) => {
        console.error('[CallSession] Failed to send emergency WhatsApp:', err);
      });
      await this.end('emergency');
      return;
    }

    // 6. If booking complete → speak confirmation + send WhatsApp
    if (result.sessionComplete && result.recommendation) {
      const confirmMessage = BOOKING_CONFIRMATION[this.state.lang];
      await this.speakIfConnected(confirmMessage);
      this.transcript.addEntry('ai', confirmMessage);

      // WhatsApp confirmation is handled by the booking engine
      await this.end('booking_complete');
      return;
    }

    // 7. If session complete without booking
    if (result.sessionComplete) {
      await this.end('booking_complete');
      return;
    }
  }

  // ─── DTMF Handling ────────────────────────────────────────────────────

  /**
   * Called when a DTMF digit is received from the caller.
   */
  async onDTMF(digit: string): Promise<void> {
    console.log(`[CallSession ${this.state.shortRef}] DTMF: ${digit}`);

    const action: DTMFAction = this.dtmfHandler.handle(digit, {
      inMenu: this.state.inMenu,
      inTriage: this.state.inTriage,
    });

    switch (action.type) {
      case 'start_voice': {
        this.state.inMenu = false;
        this.state.inTriage = true;
        const startMessage = this.getTriageStartMessage();
        this.state.lastAiResponse = startMessage;
        this.transcript.addEntry('ai', startMessage);
        await this.speakIfConnected(startMessage);
        break;
      }

      case 'request_handoff':
        await this.handleHandoff('dtmf_request', null);
        break;

      case 'repeat_last':
        await this.speakIfConnected(this.state.lastAiResponse);
        break;

      case 'confirm_yes': {
        // Treat as patient saying "yes" in the appropriate language
        if (this.state.inTriage) {
          const yesPhrase = this.state.lang === 'en' ? 'Yes' : 'أيوه';
          await this.onPatientTurnComplete(yesPhrase);
        }
        break;
      }

      case 'hangup':
        await this.end('patient_hung_up');
        break;

      case 'ignored':
        // Do nothing
        break;
    }
  }

  // ─── TTS Speaking ─────────────────────────────────────────────────────

  /**
   * Speak text via TTS and send audio to Twilio.
   * The onChunk callback is called for each audio buffer.
   */
  async speak(text: string, sendToTwilio: TwilioAudioCallback): Promise<void> {
    this.transcript.addEntry('ai', text);
    this.ttsQueue.enqueue(text);
    await this.ttsQueue.playNext(sendToTwilio);
  }

  /**
   * Internal helper: speak if we have a Twilio audio callback.
   */
  private async speakIfConnected(text: string): Promise<void> {
    if (this.sendToTwilio) {
      await this.speak(text, this.sendToTwilio);
    }
  }

  /**
   * Set the callback for sending audio to Twilio.
   * Called by the WebSocket handler when the media stream connects.
   */
  setSendToTwilio(callback: TwilioAudioCallback): void {
    this.sendToTwilio = callback;
  }

  // ─── Handoff ──────────────────────────────────────────────────────────

  private async handleHandoff(
    reason: 'patient_request' | 'dtmf_request' | 'stt_failure',
    chiefComplaint: string | null
  ): Promise<void> {
    const transferMessage = HANDOFF_MESSAGE[this.state.lang];
    await this.speakIfConnected(transferMessage);
    this.transcript.addEntry('ai', transferMessage);

    await initiateHandoff({
      callSid: this.state.callSid,
      sessionId: this.state.sessionId,
      patientPhone: this.state.callerPhone,
      tenantId: this.state.tenantId,
      reason,
      chiefComplaint,
      symptoms: [],
      specialty: null,
    });

    await this.end('agent_handoff');
  }

  // ─── STT Failure Tracking ─────────────────────────────────────────────

  /**
   * Record a consecutive STT (Speech-to-Text) failure.
   * After MAX_STT_FAILURES consecutive failures, auto-handoff to a human.
   */
  async onSttFailure(): Promise<void> {
    this.state.consecutiveSttFailures++;

    if (this.state.consecutiveSttFailures >= MAX_STT_FAILURES) {
      const failMessage = STT_FAILURE_MESSAGE[this.state.lang];
      await this.speakIfConnected(failMessage);
      this.transcript.addEntry('ai', failMessage);

      await this.handleHandoff('stt_failure', null);
    } else {
      const retryMessage = STT_RETRY_MESSAGE[this.state.lang];
      await this.speakIfConnected(retryMessage);
      this.transcript.addEntry('ai', retryMessage);
    }
  }

  // ─── Session End ──────────────────────────────────────────────────────

  /**
   * End the call session and clean up all resources.
   * Saves the transcript and call duration to the triage session.
   */
  async end(reason: CallEndReason): Promise<void> {
    console.log(`[CallSession ${this.state.shortRef}] Ending: ${reason}`);

    // Stop turn detection polling
    if (this.turnCheckInterval) {
      clearInterval(this.turnCheckInterval);
      this.turnCheckInterval = null;
    }

    // Close Deepgram connection
    this.deepgram.close();

    // Interrupt any playing TTS
    this.ttsQueue.interrupt();

    // Calculate call duration
    const durationSeconds = Math.round((Date.now() - this.callStartTime) / 1000);

    // Save transcript
    const formattedTranscript = this.transcript.format();
    if (formattedTranscript.length > 0) {
      await saveTranscript(this.state.sessionId, formattedTranscript).catch((err) => {
        console.error('[CallSession] Failed to save transcript:', err);
      });
    }

    // Update session with call metadata
    await updateSession(this.state.sessionId, {
      call_sid: this.state.callSid,
      call_duration_seconds: durationSeconds,
      session_end: new Date().toISOString(),
    }).catch((err) => {
      console.error('[CallSession] Failed to update session:', err);
    });

    // Mark abandoned if patient hung up without completing
    if (reason === 'patient_hung_up' && this.state.exchangeCount < 2) {
      await updateSession(this.state.sessionId, {
        status: 'abandoned',
      }).catch((err) => {
        console.error('[CallSession] Failed to mark abandoned:', err);
      });
    }
  }

  /**
   * Save a Twilio recording URL to the session.
   * Called by the recording status callback webhook.
   */
  async onRecordingReady(recordingUrl: string): Promise<void> {
    await saveRecordingUrl(this.state.sessionId, recordingUrl);
  }

  // ─── Getters ──────────────────────────────────────────────────────────

  /**
   * Get the initial greeting message for the IVR menu.
   * Returns bilingual greeting for english-enabled tenants.
   */
  getGreeting(): string {
    return this.state.englishEnabled ? GREETING_MESSAGE_BILINGUAL : GREETING_MESSAGE;
  }

  /**
   * Get the current conversation state (read-only snapshot).
   */
  get conversationState(): PhoneConversationState {
    return { ...this.state };
  }
}
