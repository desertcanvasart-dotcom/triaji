/**
 * Chat Tab — Triage conversation with voice input support.
 * Main screen of the app. Calls the same /api/chat as web.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useLang } from '@/hooks/useLang';
import { api } from '@/lib/api';
import { MobileVoiceRecorder } from '@/lib/voice-recorder';
import { s } from '@triaji/shared/i18n';
import type { ChatResponse, DoctorSummary } from '@triaji/shared/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  doctors?: DoctorSummary[];
  isEmergency?: boolean;
}

const voiceRecorder = new MobileVoiceRecorder();

export default function ChatScreen() {
  const { lang, isRtl } = useLang();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [recording, setRecording] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Initialize session
  useEffect(() => {
    initSession();
  }, []);

  const initSession = async () => {
    try {
      const result = await api.createSession('app');
      setSessionId(result.session.id);
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          text: s.chat.welcome[lang],
        },
      ]);
      setSessionComplete(false);
    } catch {
      Alert.alert(s.common.error[lang], s.chat.sessionError[lang]);
    }
  };

  const sendMessage = useCallback(
    async (text: string) => {
      if (!sessionId || !text.trim() || loading) return;

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: text.trim(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);

      try {
        const response: ChatResponse = await api.sendMessage(
          sessionId,
          text.trim(),
          lang
        );

        const assistantMsg: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: response.response,
          isEmergency: response.isEmergency,
          doctors: response.recommendation?.doctors,
        };
        setMessages((prev) => [...prev, assistantMsg]);

        if (response.sessionComplete) {
          setSessionComplete(true);
        }
      } catch {
        Alert.alert(s.common.error[lang], s.chat.sendError[lang]);
      } finally {
        setLoading(false);
      }
    },
    [sessionId, loading, lang]
  );

  const handleVoiceRecord = async () => {
    if (recording) {
      try {
        const uri = await voiceRecorder.stop();
        setRecording(false);
        const result = await api.transcribeAudio(uri);
        if (result.text) {
          setInput(result.text);
        }
      } catch {
        setRecording(false);
      }
    } else {
      try {
        await voiceRecorder.start();
        setRecording(true);
      } catch {
        Alert.alert(
          s.common.error[lang],
          lang === 'ar'
            ? 'فشل تشغيل الميكروفون'
            : 'Failed to start microphone'
        );
      }
    }
  };

  const handleDoctorPress = (doctorId: string) => {
    router.push(`/booking/${doctorId}`);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';

    return (
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          isRtl && styles.bubbleRtl,
        ]}
      >
        {item.isEmergency && (
          <View style={styles.emergencyBanner}>
            <Text style={styles.emergencyText}>
              {s.emergency.callNow[lang]}
            </Text>
          </View>
        )}

        <Text
          style={[
            styles.messageText,
            isUser ? styles.userText : styles.assistantText,
            isRtl && styles.textRtl,
          ]}
        >
          {item.text}
        </Text>

        {item.doctors && item.doctors.length > 0 && (
          <View style={styles.doctorList}>
            {item.doctors.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                style={styles.doctorCard}
                onPress={() => handleDoctorPress(doc.id)}
              >
                <Text style={[styles.doctorName, isRtl && styles.textRtl]}>
                  {lang === 'ar' ? doc.nameAr : (doc.nameEn ?? doc.nameAr)}
                </Text>
                <Text style={[styles.doctorSpec, isRtl && styles.textRtl]}>
                  {lang === 'ar'
                    ? doc.specialtyNameAr
                    : (doc.specialtyNameEn ?? doc.specialtyNameAr)}
                </Text>
                <View style={styles.doctorMeta}>
                  {doc.consultationFeeEgp != null && (
                    <Text style={styles.doctorFee}>
                      {doc.consultationFeeEgp} {s.booking.fee[lang]}
                    </Text>
                  )}
                  {doc.rating != null && (
                    <Text style={styles.doctorRating}>
                      ⭐ {doc.rating.toFixed(1)}
                    </Text>
                  )}
                  {doc.distanceKm != null && (
                    <Text style={styles.doctorDistance}>
                      {doc.distanceKm.toFixed(1)} {s.booking.distance[lang]}
                    </Text>
                  )}
                </View>
                <Text style={styles.bookBtn}>
                  {s.booking.bookDoctor[lang]} →
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRtl && styles.textRtl]}>
          {s.common.appName[lang]}
        </Text>
        <Text style={[styles.headerSubtitle, isRtl && styles.textRtl]}>
          {s.chat.headerSubtitle[lang]}
        </Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />

      {/* Loading indicator */}
      {loading && (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color="#0D7A7A" />
          <Text style={styles.typingText}>{s.chat.typing[lang]}</Text>
        </View>
      )}

      {/* Input */}
      {!sessionComplete ? (
        <View style={[styles.inputRow, isRtl && styles.inputRowRtl]}>
          <TouchableOpacity
            onPress={handleVoiceRecord}
            style={[styles.voiceBtn, recording && styles.voiceBtnActive]}
          >
            <Text style={styles.voiceIcon}>{recording ? '⏹' : '🎤'}</Text>
          </TouchableOpacity>

          <TextInput
            style={[styles.textInput, isRtl && styles.textInputRtl]}
            value={input}
            onChangeText={setInput}
            placeholder={s.chat.placeholder[lang]}
            placeholderTextColor="#999"
            multiline
            maxLength={2000}
          />

          <TouchableOpacity
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          >
            <Text style={styles.sendIcon}>{'➤'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.newSessionBtn} onPress={initSession}>
          <Text style={styles.newSessionText}>
            {s.chat.newSession[lang]}
          </Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#0D7A7A',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Cairo-Bold',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Cairo',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    maxWidth: '85%',
    marginBottom: 12,
    borderRadius: 16,
    padding: 12,
  },
  bubbleRtl: {
    alignSelf: 'flex-end',
  },
  userBubble: {
    backgroundColor: '#0D7A7A',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 24,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: '#1A2F4A',
  },
  emergencyBanner: {
    backgroundColor: '#C62828',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  emergencyText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
  doctorList: {
    marginTop: 12,
    gap: 8,
  },
  doctorCard: {
    backgroundColor: '#F0FAFA',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#B2DFDB',
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
  },
  doctorSpec: {
    fontSize: 13,
    color: '#0D7A7A',
    marginBottom: 6,
    fontFamily: 'Cairo',
  },
  doctorMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  doctorFee: {
    fontSize: 13,
    color: '#666',
  },
  doctorRating: {
    fontSize: 13,
    color: '#666',
  },
  doctorDistance: {
    fontSize: 13,
    color: '#666',
  },
  bookBtn: {
    color: '#0D7A7A',
    fontWeight: '700',
    fontSize: 14,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  typingText: {
    color: '#999',
    fontSize: 13,
    fontFamily: 'Cairo',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 8,
  },
  inputRowRtl: {
    flexDirection: 'row-reverse',
  },
  voiceBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceBtnActive: {
    backgroundColor: '#FFCDD2',
  },
  voiceIcon: {
    fontSize: 20,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    backgroundColor: '#FAFAFA',
  },
  textInputRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0D7A7A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 20,
  },
  newSessionBtn: {
    backgroundColor: '#0D7A7A',
    margin: 16,
    marginBottom: 32,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  newSessionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
});
