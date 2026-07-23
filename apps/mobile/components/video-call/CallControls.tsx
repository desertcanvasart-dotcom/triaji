/**
 * CallControls — bottom bar with circular action buttons during a video call.
 * Mute, Camera, Speaker, End Call, optional Chat, optional Notes (doctor only).
 * Notes button opens a slide-up panel for in-call note-taking saved as draft
 * to gp_video_calls.structured_notes_ar.
 */

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { Lang } from '@triaji/shared/i18n';
import { s } from '@triaji/shared/i18n';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const NOTES_PANEL_HEIGHT = 320;

interface CallControlsProps {
  role: 'doctor' | 'patient';
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeakerOn: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleSpeaker: () => void;
  onEndCall: () => void;
  onOpenChat?: () => void;
  onOpenNotes?: () => void;
  lang: Lang;
  callId?: string;
}

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.doctortrio.online';

export default function CallControls({
  role,
  isMuted,
  isCameraOff,
  isSpeakerOn,
  onToggleMute,
  onToggleCamera,
  onToggleSpeaker,
  onEndCall,
  onOpenChat,
  lang,
  callId,
}: CallControlsProps) {
  const isRtl = lang === 'ar';
  const [notesPanelOpen, setNotesPanelOpen] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [saving, setSaving] = useState(false);
  const panelAnim = useRef(new Animated.Value(0)).current;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save draft notes every 10 seconds when changed
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const saveDraftNotes = async (text: string) => {
    if (!callId || !text.trim()) return;

    setSaving(true);
    try {
      const { storage } = await import('@/lib/storage');
      const token = storage.getString('doctor-token') ?? '';

      await fetch(`${API_BASE_URL}/api/telehealth/gp-call/${callId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ structured_notes_ar: text }),
      });
    } catch {
      // Silent fail — draft save
    } finally {
      setSaving(false);
    }
  };

  const handleNotesChange = (text: string) => {
    setNotesText(text);

    // Debounce auto-save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveDraftNotes(text);
    }, 5000);
  };

  const toggleNotesPanel = () => {
    const toOpen = !notesPanelOpen;
    setNotesPanelOpen(toOpen);

    Animated.spring(panelAnim, {
      toValue: toOpen ? 1 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();

    // Save when closing
    if (!toOpen && notesText.trim()) {
      saveDraftNotes(notesText);
    }
  };

  /** Get current notes text (exposed for post-call form pre-loading) */
  const getNotesText = () => notesText;

  const panelTranslateY = panelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [NOTES_PANEL_HEIGHT, 0],
  });

  return (
    <View style={styles.wrapper}>
      {/* Notes slide-up panel (doctor only) */}
      {role === 'doctor' && notesPanelOpen && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.notesPanelWrapper}
        >
          <Animated.View
            style={[
              styles.notesPanel,
              { transform: [{ translateY: panelTranslateY }] },
            ]}
          >
            <View style={[styles.notesPanelHeader, isRtl && styles.rowRtl]}>
              <Text style={[styles.notesPanelTitle, isRtl && styles.textRtl]}>
                {s.videoCall.notes[lang]}
              </Text>
              {saving && (
                <Text style={styles.savingIndicator}>
                  {s.common.save[lang]}...
                </Text>
              )}
            </View>

            <TextInput
              style={[styles.notesInput, isRtl && styles.inputRtl]}
              placeholder={s.videoCall.editNotes[lang]}
              placeholderTextColor="#999"
              value={notesText}
              onChangeText={handleNotesChange}
              multiline
              textAlignVertical="top"
              autoFocus
            />

            <TouchableOpacity
              style={styles.saveNotesBtn}
              onPress={() => {
                saveDraftNotes(notesText);
                toggleNotesPanel();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.saveNotesBtnText}>
                {s.common.save[lang]}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      )}

      {/* Control bar */}
      <View style={styles.container}>
        <View style={[styles.controlRow, isRtl && styles.rowRtl]}>
          {/* Mute */}
          <TouchableOpacity
            style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
            onPress={onToggleMute}
            activeOpacity={0.7}
          >
            <Text style={styles.controlIcon}>{isMuted ? '🔇' : '🎤'}</Text>
            <Text style={styles.controlLabel}>
              {isMuted ? s.videoCall.unmute[lang] : s.videoCall.mute[lang]}
            </Text>
          </TouchableOpacity>

          {/* Camera */}
          <TouchableOpacity
            style={[styles.controlBtn, isCameraOff && styles.controlBtnActive]}
            onPress={onToggleCamera}
            activeOpacity={0.7}
          >
            <Text style={styles.controlIcon}>{isCameraOff ? '📷' : '📹'}</Text>
            <Text style={styles.controlLabel}>
              {isCameraOff
                ? s.videoCall.cameraOn[lang]
                : s.videoCall.cameraOff[lang]}
            </Text>
          </TouchableOpacity>

          {/* Speaker */}
          <TouchableOpacity
            style={[styles.controlBtn, isSpeakerOn && styles.controlBtnActive]}
            onPress={onToggleSpeaker}
            activeOpacity={0.7}
          >
            <Text style={styles.controlIcon}>{isSpeakerOn ? '🔊' : '🔈'}</Text>
            <Text style={styles.controlLabel}>
              {s.videoCall.speaker[lang]}
            </Text>
          </TouchableOpacity>

          {/* Chat (optional) */}
          {onOpenChat && (
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={onOpenChat}
              activeOpacity={0.7}
            >
              <Text style={styles.controlIcon}>💬</Text>
              <Text style={styles.controlLabel}>
                {s.videoCall.chat[lang]}
              </Text>
            </TouchableOpacity>
          )}

          {/* Notes (doctor only) */}
          {role === 'doctor' && (
            <TouchableOpacity
              style={[
                styles.controlBtn,
                notesPanelOpen && styles.controlBtnActive,
              ]}
              onPress={toggleNotesPanel}
              activeOpacity={0.7}
            >
              <Text style={styles.controlIcon}>📋</Text>
              <Text style={styles.controlLabel}>
                {s.videoCall.notes[lang]}
              </Text>
            </TouchableOpacity>
          )}

          {/* End Call */}
          <TouchableOpacity
            style={styles.endCallBtn}
            onPress={onEndCall}
            activeOpacity={0.7}
          >
            <Text style={styles.endCallIcon}>📞</Text>
            <Text style={styles.endCallLabel}>
              {s.videoCall.endCall[lang]}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/** Export helper to get notes text for post-call pre-loading */
export { CallControls };

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingBottom: 36,
    paddingTop: 16,
    paddingHorizontal: 12,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  controlIcon: {
    fontSize: 22,
  },
  controlLabel: {
    fontSize: 9,
    color: '#FFFFFF',
    fontFamily: 'Cairo',
    marginTop: 2,
  },
  endCallBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EF4444',
  },
  endCallIcon: {
    fontSize: 22,
    transform: [{ rotate: '135deg' }],
  },
  endCallLabel: {
    fontSize: 9,
    color: '#FFFFFF',
    fontFamily: 'Cairo',
    marginTop: 2,
  },

  // Notes panel
  notesPanelWrapper: {
    marginBottom: 0,
  },
  notesPanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    height: NOTES_PANEL_HEIGHT,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  notesPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  notesPanelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  savingIndicator: {
    fontSize: 12,
    color: '#0D7A7A',
    fontFamily: 'Cairo',
  },
  notesInput: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Cairo',
    color: '#333',
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#EEE',
    marginBottom: 10,
  },
  inputRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  saveNotesBtn: {
    backgroundColor: '#0D7A7A',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveNotesBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
});
