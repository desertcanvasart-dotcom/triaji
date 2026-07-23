/**
 * Health Assistant Screen — AI chat about patient's medical records.
 * Streaming via SSE from POST /api/health-assistant/chat.
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
  ScrollView,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { useLang } from '@/hooks/useLang';
import { useAuth } from '@/hooks/useAuth';
import { isAuthenticated, getPatientToken } from '@/lib/storage';
import { s, t } from '@triaji/shared/i18n';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'https://app.doctortrio.online';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Suggestion {
  id: string;
  text_ar: string;
  text_en: string;
}

interface ContextInfo {
  lastLabDate: string | null;
  lastVisitDate: string | null;
  activeMedsCount: number;
}

interface ThresholdCheckResult {
  eligible: boolean;
  context: ContextInfo | null;
  patientName: string;
}

// ─── Typing Dots ────────────────────────────────────────────────────────────

function TypingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const createAnimation = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );

    const a1 = createAnimation(dot1, 0);
    const a2 = createAnimation(dot2, 150);
    const a3 = createAnimation(dot3, 300);
    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={dotStyles.container}>
      <Animated.View style={[dotStyles.dot, { opacity: dot1 }]} />
      <Animated.View style={[dotStyles.dot, { opacity: dot2 }]} />
      <Animated.View style={[dotStyles.dot, { opacity: dot3 }]} />
    </View>
  );
}

const dotStyles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 6, paddingVertical: 8, paddingHorizontal: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#999' },
});

// ─── Component ──────────────────────────────────────────────────────────────

export default function HealthAssistantScreen() {
  const { lang, isRtl } = useLang();
  const { patientName } = useAuth();

  // State
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [contextInfo, setContextInfo] = useState<ContextInfo | null>(null);
  const [contextExpanded, setContextExpanded] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [recording, setRecording] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // ─── Auth header ────────────────────────────────────────────────────────

  const getHeaders = (): Record<string, string> => {
    const token = getPatientToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // ─── Threshold check ──────────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated()) {
      setEligible(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/health-assistant/eligibility`, {
          headers: getHeaders(),
        });
        if (!res.ok) {
          setEligible(false);
          return;
        }
        const data = (await res.json()) as ThresholdCheckResult;
        setEligible(data.eligible);
        setContextInfo(data.context ?? null);
      } catch {
        setEligible(false);
      }
    })();
  }, []);

  // ─── Fetch suggestions ───────────────────────────────────────────────

  useEffect(() => {
    if (!eligible) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/health-assistant/suggestions`, {
          headers: getHeaders(),
        });
        if (res.ok) {
          const data = (await res.json()) as { suggestions: Suggestion[] };
          setSuggestions(data.suggestions ?? []);
        }
      } catch {
        // Silent
      }
    })();
  }, [eligible]);

  // ─── Send message (SSE streaming) ────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsStreaming(true);
      setStreamingText('');

      // Haptic feedback
      try {
        const Haptics = await import('expo-haptics').catch(() => null);
        if (Haptics) {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch {
        // Haptics not available
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/health-assistant/chat`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ message: trimmed, sessionId, lang }),
        });

        if (!response.ok) throw new Error('Request failed');

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader');

        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'text') {
                  accumulated += data.content;
                  setStreamingText(accumulated);
                }
                if (data.type === 'done') {
                  if (data.sessionId) setSessionId(data.sessionId);
                }
              } catch {
                // Skip malformed SSE
              }
            }
          }
        }

        if (accumulated) {
          const aiMsg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: accumulated,
          };
          setMessages((prev) => [...prev, aiMsg]);
        }
      } catch {
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: s.common.error[lang],
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsStreaming(false);
        setStreamingText('');
      }
    },
    [isStreaming, sessionId, lang]
  );

  // ─── Voice recording ─────────────────────────────────────────────────

  const handleVoiceRecord = async () => {
    if (recording) {
      try {
        const { MobileVoiceRecorder } = await import('@/lib/voice-recorder');
        const recorder = new MobileVoiceRecorder();
        const uri = await recorder.stop();
        setRecording(false);
        const { api } = await import('@/lib/api');
        const result = await api.transcribeAudio(uri);
        if (result.text) setInput(result.text);
      } catch {
        setRecording(false);
      }
    } else {
      try {
        const { MobileVoiceRecorder } = await import('@/lib/voice-recorder');
        const recorder = new MobileVoiceRecorder();
        await recorder.start();
        setRecording(true);
      } catch {
        // Microphone not available
      }
    }
  };

  // ─── Format helpers ───────────────────────────────────────────────────

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '---';
    try {
      return new Date(dateStr).toLocaleDateString(
        lang === 'ar' ? 'ar-EG' : 'en-US',
        { day: 'numeric', month: 'short' }
      );
    } catch {
      return dateStr;
    }
  };

  // ─── Auto-scroll ──────────────────────────────────────────────────────

  const allDisplayMessages = [...messages];
  if (isStreaming && streamingText) {
    allDisplayMessages.push({
      id: 'streaming',
      role: 'assistant',
      content: streamingText,
    });
  }

  useEffect(() => {
    if (allDisplayMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [allDisplayMessages.length, streamingText]);

  // ─── Render: loading ──────────────────────────────────────────────────

  if (eligible === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0D7A7A" />
      </View>
    );
  }

  // ─── Render: empty record ─────────────────────────────────────────────

  if (!eligible) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.headerRow, isRtl && styles.rowRtl]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backIcon}>{isRtl ? '→' : '←'}</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, isRtl && styles.textRtl]}>
              {t('healthAssistant.title', lang)}
            </Text>
            <View style={{ width: 44 }} />
          </View>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={[styles.emptyTitle, isRtl && styles.textRtl]}>
            {t('healthAssistant.title', lang)}
          </Text>
          <Text style={[styles.emptyText, isRtl && styles.textRtl]}>
            {t('healthAssistant.emptyRecord', lang)}
          </Text>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => router.push('/(patient)/chat')}
          >
            <Text style={styles.ctaBtnText}>
              {s.home.startTriage[lang]}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Render: chat ─────────────────────────────────────────────────────

  const greeting = t('healthAssistant.greeting', lang).replace(
    '{name}',
    patientName ?? (lang === 'ar' ? 'ضيف' : 'Guest')
  );
  const hasMessages = messages.length > 0;

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={[
          msgStyles.bubble,
          isUser ? msgStyles.userBubble : msgStyles.assistantBubble,
        ]}
      >
        <Text
          style={[
            msgStyles.text,
            isUser ? msgStyles.userText : msgStyles.assistantText,
            isRtl && styles.textRtl,
          ]}
        >
          {item.content}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerRow, isRtl && styles.rowRtl]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>{isRtl ? '→' : '←'}</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, isRtl && styles.textRtl]}>
              {t('healthAssistant.title', lang)}
            </Text>
            <Text style={[styles.headerSubtitle, isRtl && styles.textRtl]}>
              {t('healthAssistant.subtitle', lang)}
            </Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
      </View>

      {/* Context banner (collapsible) */}
      {contextInfo && (
        <TouchableOpacity
          style={styles.contextBanner}
          onPress={() => setContextExpanded(!contextExpanded)}
          activeOpacity={0.7}
        >
          <View style={[styles.contextHeader, isRtl && styles.rowRtl]}>
            <Text style={[styles.contextTitle, isRtl && styles.textRtl]}>
              {t('healthAssistant.contextBanner', lang)}
            </Text>
            <Text style={styles.contextChevron}>
              {contextExpanded ? '▲' : '▼'}
            </Text>
          </View>
          {contextExpanded && (
            <View style={styles.contextBody}>
              <View style={styles.contextRow}>
                <View style={styles.contextItem}>
                  <Text style={[styles.contextLabel, isRtl && styles.textRtl]}>
                    {t('healthAssistant.lastLabResults', lang)}
                  </Text>
                  <Text style={[styles.contextValue, isRtl && styles.textRtl]}>
                    {formatDate(contextInfo.lastLabDate)}
                  </Text>
                </View>
                <View style={styles.contextItem}>
                  <Text style={[styles.contextLabel, isRtl && styles.textRtl]}>
                    {t('healthAssistant.lastVisit', lang)}
                  </Text>
                  <Text style={[styles.contextValue, isRtl && styles.textRtl]}>
                    {formatDate(contextInfo.lastVisitDate)}
                  </Text>
                </View>
                <View style={styles.contextItem}>
                  <Text style={[styles.contextLabel, isRtl && styles.textRtl]}>
                    {t('healthAssistant.activeMeds', lang)}
                  </Text>
                  <Text style={[styles.contextValue, isRtl && styles.textRtl]}>
                    {contextInfo.activeMedsCount}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Greeting + suggestions (shown when no messages) */}
      {!hasMessages ? (
        <ScrollView contentContainerStyle={styles.greetingContainer}>
          <Text style={[styles.greetingTitle, isRtl && styles.textRtl]}>
            {greeting}
          </Text>
          <Text style={[styles.greetingSubtitle, isRtl && styles.textRtl]}>
            {t('healthAssistant.greetingSubtitle', lang)}
          </Text>

          {suggestions.length > 0 && (
            <View style={styles.suggestionsSection}>
              <Text style={[styles.suggestionsLabel, isRtl && styles.textRtl]}>
                {t('healthAssistant.suggestions', lang)}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionsScroll}
              >
                {suggestions.map((sug) => (
                  <TouchableOpacity
                    key={sug.id}
                    style={styles.suggestionChip}
                    onPress={() => {
                      const text = lang === 'ar' ? sug.text_ar : sug.text_en;
                      setInput(text);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.suggestionText, isRtl && styles.textRtl]}>
                      {lang === 'ar' ? sug.text_ar : sug.text_en}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      ) : (
        /* Messages list */
        <FlatList
          ref={flatListRef}
          data={allDisplayMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          ListFooterComponent={
            isStreaming && !streamingText ? (
              <View style={msgStyles.assistantBubble}>
                <TypingDots />
              </View>
            ) : null
          }
        />
      )}

      {/* Disclaimer */}
      <View style={styles.disclaimerBar}>
        <Text style={[styles.disclaimerText, isRtl && styles.textRtl]}>
          {t('healthAssistant.disclaimer', lang)}
        </Text>
      </View>

      {/* Input bar */}
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
          placeholder={t('healthAssistant.inputPlaceholder', lang)}
          placeholderTextColor="#999"
          multiline
          maxLength={2000}
          editable={!isStreaming}
        />

        <TouchableOpacity
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || isStreaming}
          style={[
            styles.sendBtn,
            (!input.trim() || isStreaming) && styles.sendBtnDisabled,
          ]}
        >
          <Text style={styles.sendIcon}>{'▶'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Message Styles ─────────────────────────────────────────────────────────

const msgStyles = StyleSheet.create({
  bubble: {
    maxWidth: '85%',
    marginBottom: 12,
    borderRadius: 16,
    padding: 12,
  },
  userBubble: {
    backgroundColor: '#0D7A7A',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#F3F4F6',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 24,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: '#1A2F4A',
  },
});

// ─── Main Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#0D7A7A',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  headerCenter: {
    flex: 1,
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Cairo-Bold',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Cairo',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  // Context banner
  contextBanner: {
    backgroundColor: '#E0F2F1',
    borderBottomWidth: 1,
    borderBottomColor: '#B2DFDB',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  contextHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contextTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00695C',
    fontFamily: 'Cairo-SemiBold',
  },
  contextChevron: {
    fontSize: 10,
    color: '#00695C',
  },
  contextBody: {
    marginTop: 10,
  },
  contextRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  contextItem: {
    alignItems: 'center',
  },
  contextLabel: {
    fontSize: 11,
    color: '#00796B',
    fontFamily: 'Cairo',
  },
  contextValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#004D40',
    fontFamily: 'Cairo-Bold',
  },

  // Greeting
  greetingContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
    marginBottom: 8,
  },
  greetingSubtitle: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Cairo',
    lineHeight: 22,
  },

  // Suggestions
  suggestionsSection: {
    marginTop: 24,
  },
  suggestionsLabel: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'Cairo',
    marginBottom: 8,
  },
  suggestionsScroll: {
    gap: 8,
    paddingRight: 16,
  },
  suggestionChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B2DFDB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  suggestionText: {
    fontSize: 13,
    color: '#0D7A7A',
    fontFamily: 'Cairo',
  },

  // Messages
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },

  // Disclaimer
  disclaimerBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#FFF8E1',
  },
  disclaimerText: {
    fontSize: 10,
    color: '#795548',
    fontFamily: 'Cairo',
    textAlign: 'center',
  },

  // Input
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
    fontSize: 18,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A2F4A',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'Cairo',
    textAlign: 'center',
    lineHeight: 22,
  },
  ctaBtn: {
    backgroundColor: '#0D7A7A',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 20,
  },
  ctaBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
});
