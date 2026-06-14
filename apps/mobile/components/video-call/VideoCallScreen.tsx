/**
 * VideoCallScreen — main video call interface using LiveKit.
 * Remote video full-screen, local video PiP in corner.
 * Includes call timer, connection quality indicator, poor connection banner,
 * recording consent, and call controls.
 * On unmount / back: ends call.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  BackHandler,
  Platform,
  ActivityIndicator,
} from 'react-native';
import type { Lang } from '@triaji/shared/i18n';
import { s } from '@triaji/shared/i18n';
import CallTimer from './CallTimer';
import ConnectionQuality from './ConnectionQuality';
import CallControls from './CallControls';
import RecordingConsent from './RecordingConsent';
import InCallChat from './InCallChat';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PIP_WIDTH = 120;
const PIP_HEIGHT = 160;

type ConnectionQualityLevel = 'good' | 'fair' | 'poor';

interface VideoCallScreenProps {
  callId: string;
  role: 'doctor' | 'patient';
  lang: Lang;
  token: string;
  serverUrl: string;
  onCallEnd: () => void;
}

export default function VideoCallScreen({
  callId,
  role,
  lang,
  token,
  serverUrl,
  onCallEnd,
}: VideoCallScreenProps) {
  const isRtl = lang === 'ar';

  // Call state
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);

  // Media state
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  // Connection quality
  const [quality, setQuality] = useState<ConnectionQualityLevel>('good');
  const [showPoorBanner, setShowPoorBanner] = useState(false);
  const poorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recording consent
  const [showRecordingConsent, setShowRecordingConsent] = useState(true);
  const [recordingDeclined, setRecordingDeclined] = useState(false);

  // Chat
  const [chatVisible, setChatVisible] = useState(false);

  // LiveKit room reference (will be populated by LiveKit integration)
  const roomRef = useRef<unknown>(null);

  // ─── Connect to LiveKit Room ─────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    async function connectToRoom() {
      try {
        const { Room, RoomEvent } = await import('@livekit/react-native');

        const room = new Room();
        roomRef.current = room;

        // Connection quality monitoring
        room.on(RoomEvent.ConnectionQualityChanged, (_quality: unknown, participant: unknown) => {
          if (!mounted) return;
          // Map LiveKit quality to our levels
          const qualityMap: Record<string, ConnectionQualityLevel> = {
            excellent: 'good',
            good: 'good',
            fair: 'fair',
            poor: 'poor',
            lost: 'poor',
          };
          const mappedQuality = qualityMap[String(_quality)] ?? 'good';
          setQuality(mappedQuality);
        });

        room.on(RoomEvent.Connected, () => {
          if (!mounted) return;
          setConnected(true);
          setConnecting(false);
          setCallStartTime(new Date());
        });

        room.on(RoomEvent.Disconnected, () => {
          if (!mounted) return;
          handleEndCall();
        });

        await room.connect(serverUrl, token);
      } catch (err) {
        console.error('[VideoCall] Connection error:', err);
        if (mounted) {
          setConnecting(false);
        }
      }
    }

    connectToRoom();

    return () => {
      mounted = false;
      disconnectRoom();
    };
  }, [serverUrl, token]);

  // ─── Poor Connection Banner (10 second threshold) ────────────────────────

  useEffect(() => {
    if (quality === 'poor') {
      if (!poorTimerRef.current) {
        poorTimerRef.current = setTimeout(() => {
          setShowPoorBanner(true);
        }, 10000);
      }
    } else {
      if (poorTimerRef.current) {
        clearTimeout(poorTimerRef.current);
        poorTimerRef.current = null;
      }
      setShowPoorBanner(false);
    }

    return () => {
      if (poorTimerRef.current) clearTimeout(poorTimerRef.current);
    };
  }, [quality]);

  // ─── Hardware Back Button (Android) ──────────────────────────────────────

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleEndCall();
      return true;
    });
    return () => subscription.remove();
  }, []);

  // ─── Room Actions ────────────────────────────────────────────────────────

  const disconnectRoom = async () => {
    try {
      const room = roomRef.current as { disconnect?: () => Promise<void> } | null;
      if (room?.disconnect) {
        await room.disconnect();
      }
    } catch {
      // Silent
    }
    roomRef.current = null;
  };

  const handleEndCall = useCallback(async () => {
    await disconnectRoom();
    onCallEnd();
  }, [onCallEnd]);

  const handleToggleMute = useCallback(async () => {
    try {
      const room = roomRef.current as {
        localParticipant?: {
          setMicrophoneEnabled: (enabled: boolean) => Promise<void>;
        };
      } | null;
      if (room?.localParticipant) {
        await room.localParticipant.setMicrophoneEnabled(isMuted);
        setIsMuted(!isMuted);
      }
    } catch {
      // Silent
    }
  }, [isMuted]);

  const handleToggleCamera = useCallback(async () => {
    try {
      const room = roomRef.current as {
        localParticipant?: {
          setCameraEnabled: (enabled: boolean) => Promise<void>;
        };
      } | null;
      if (room?.localParticipant) {
        await room.localParticipant.setCameraEnabled(isCameraOff);
        setIsCameraOff(!isCameraOff);
      }
    } catch {
      // Silent
    }
  }, [isCameraOff]);

  const handleToggleSpeaker = useCallback(() => {
    setIsSpeakerOn(!isSpeakerOn);
    // Speaker toggle is handled at the device level
    // LiveKit RN handles this automatically via AudioSession
  }, [isSpeakerOn]);

  // ─── Recording Consent ───────────────────────────────────────────────────

  const handleRecordingAccept = useCallback(() => {
    setShowRecordingConsent(false);
    // Notify server that recording is consented
  }, []);

  const handleRecordingDecline = useCallback(() => {
    setShowRecordingConsent(false);
    setRecordingDeclined(true);
    // Notify server — recording will not happen
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (connecting) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0D7A7A" />
        <Text style={[styles.loadingText, isRtl && styles.textRtl]}>
          {s.videoCall.calling[lang]}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Remote Video — Full Screen */}
      <View style={styles.remoteVideo}>
        {connected ? (
          <View style={styles.remoteVideoPlaceholder}>
            {/* LiveKit VideoTrack will render here when integrated */}
            <Text style={styles.placeholderText}>
              {/* Remote participant video stream */}
            </Text>
          </View>
        ) : (
          <View style={styles.remoteVideoPlaceholder}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        )}
      </View>

      {/* Local Video — PiP (corner) */}
      {!isCameraOff && (
        <View style={[styles.localVideo, isRtl ? styles.localVideoRtl : null]}>
          <View style={styles.localVideoPlaceholder}>
            {/* LiveKit local VideoTrack will render here */}
            <Text style={styles.localPlaceholderText}>📹</Text>
          </View>
        </View>
      )}

      {/* Top overlay — timer + quality */}
      <View style={[styles.topOverlay, isRtl && styles.topOverlayRtl]}>
        {callStartTime && <CallTimer startTime={callStartTime} />}
        <ConnectionQuality quality={quality} />
      </View>

      {/* Poor connection banner */}
      {showPoorBanner && (
        <View style={styles.poorBanner}>
          <Text style={[styles.poorBannerText, isRtl && styles.textRtl]}>
            {s.videoCall.poorConnection[lang]}
          </Text>
        </View>
      )}

      {/* Recording consent banner */}
      {showRecordingConsent && role === 'patient' && (
        <View style={styles.consentOverlay}>
          <RecordingConsent
            lang={lang}
            onAccept={handleRecordingAccept}
            onDecline={handleRecordingDecline}
          />
        </View>
      )}

      {/* Patient declined recording notice (doctor side) */}
      {recordingDeclined && role === 'doctor' && (
        <View style={styles.recordingDeclinedBanner}>
          <Text style={[styles.recordingDeclinedText, isRtl && styles.textRtl]}>
            {s.videoCall.patientDeclinedRecording[lang]}
          </Text>
        </View>
      )}

      {/* In-call chat panel */}
      <InCallChat
        roomName={callId}
        participantName={role === 'doctor' ? 'Doctor' : 'Patient'}
        lang={lang}
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
      />

      {/* Call Controls */}
      <CallControls
        role={role}
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        isSpeakerOn={isSpeakerOn}
        onToggleMute={handleToggleMute}
        onToggleCamera={handleToggleCamera}
        onToggleSpeaker={handleToggleSpeaker}
        onEndCall={handleEndCall}
        onOpenChat={() => setChatVisible(true)}
        lang={lang}
        callId={callId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1A2F4A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Cairo',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  // Remote video
  remoteVideo: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  remoteVideoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: 'transparent',
  },

  // Local video PiP
  localVideo: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 16,
    width: PIP_WIDTH,
    height: PIP_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#333',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 10,
  },
  localVideoRtl: {
    right: undefined,
    left: 16,
  },
  localVideoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A2A2A',
  },
  localPlaceholderText: {
    fontSize: 32,
  },

  // Top overlay
  topOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 5,
  },
  topOverlayRtl: {
    left: undefined,
    right: PIP_WIDTH + 32,
    flexDirection: 'row-reverse',
  },

  // Poor connection banner
  poorBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    zIndex: 5,
  },
  poorBannerText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: 'Cairo-SemiBold',
    fontWeight: '600',
    textAlign: 'center',
  },

  // Recording consent overlay
  consentOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 140 : 120,
    left: 0,
    right: 0,
    zIndex: 6,
  },

  // Recording declined banner
  recordingDeclinedBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.9)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    zIndex: 5,
  },
  recordingDeclinedText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: 'Cairo-SemiBold',
    fontWeight: '600',
    textAlign: 'center',
  },
});
