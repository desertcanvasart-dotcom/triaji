/**
 * InCallChat — slide-up chat panel for in-call messaging.
 * Useful when audio quality is poor. Simple send/receive text messages
 * using LiveKit data channels.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { Lang } from '@triaji/shared/i18n';
import { s } from '@triaji/shared/i18n';

const PANEL_HEIGHT = Dimensions.get('window').height * 0.5;

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: Date;
  isLocal: boolean;
}

interface InCallChatProps {
  roomName: string;
  participantName: string;
  lang: Lang;
  visible: boolean;
  onClose: () => void;
  onSendMessage?: (text: string) => void;
  incomingMessages?: Array<{ sender: string; text: string; timestamp: Date }>;
}

export default function InCallChat({
  roomName,
  participantName,
  lang,
  visible,
  onClose,
  onSendMessage,
  incomingMessages,
}: InCallChatProps) {
  const isRtl = lang === 'ar';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const slideAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const msgCountRef = useRef(0);

  // Animate panel in/out
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [visible, slideAnim]);

  // Process incoming messages
  useEffect(() => {
    if (!incomingMessages || incomingMessages.length === 0) return;

    const newMsgs: ChatMessage[] = incomingMessages.map((msg, i) => ({
      id: `remote-${Date.now()}-${i}`,
      sender: msg.sender,
      text: msg.text,
      timestamp: msg.timestamp,
      isLocal: false,
    }));

    setMessages((prev) => [...prev, ...newMsgs]);
  }, [incomingMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messages.length > msgCountRef.current) {
      msgCountRef.current = messages.length;
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;

    const newMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      sender: participantName,
      text,
      timestamp: new Date(),
      isLocal: true,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');

    onSendMessage?.(text);
  }, [inputText, participantName, onSendMessage]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [PANEL_HEIGHT, 0],
  });

  if (!visible) return null;

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View
      style={[
        styles.messageBubble,
        item.isLocal ? styles.localBubble : styles.remoteBubble,
      ]}
    >
      {!item.isLocal && (
        <Text style={[styles.senderName, isRtl && styles.textRtl]}>
          {item.sender}
        </Text>
      )}
      <Text
        style={[
          styles.messageText,
          item.isLocal ? styles.localText : styles.remoteText,
          isRtl && styles.textRtl,
        ]}
      >
        {item.text}
      </Text>
      <Text
        style={[
          styles.messageTime,
          item.isLocal ? styles.localTime : styles.remoteTime,
        ]}
      >
        {item.timestamp.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.overlay}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      <Animated.View
        style={[styles.panel, { transform: [{ translateY }] }]}
      >
        {/* Header */}
        <View style={[styles.panelHeader, isRtl && styles.rowRtl]}>
          <Text style={[styles.panelTitle, isRtl && styles.textRtl]}>
            {s.videoCall.chat[lang]}
          </Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeBtn}>{s.common.close[lang]}</Text>
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          showsVerticalScrollIndicator={false}
        />

        {/* Input */}
        <View style={[styles.inputRow, isRtl && styles.rowRtl]}>
          <TextInput
            style={[styles.input, isRtl && styles.inputRtl]}
            placeholder={s.chat.placeholder[lang]}
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
            activeOpacity={0.7}
          >
            <Text style={styles.sendBtnText}>{s.chat.send[lang]}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  panel: {
    height: PANEL_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2F4A',
    fontFamily: 'Cairo-Bold',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  closeBtn: {
    fontSize: 14,
    color: '#0D7A7A',
    fontFamily: 'Cairo-SemiBold',
    fontWeight: '600',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    gap: 8,
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  localBubble: {
    backgroundColor: '#0D7A7A',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  remoteBubble: {
    backgroundColor: '#F0F0F0',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    fontFamily: 'Cairo-SemiBold',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15,
    fontFamily: 'Cairo',
    lineHeight: 22,
  },
  localText: {
    color: '#FFFFFF',
  },
  remoteText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
  },
  localTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  remoteTime: {
    color: '#999',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: 'Cairo',
    color: '#333',
  },
  inputRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sendBtn: {
    backgroundColor: '#0D7A7A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
});
