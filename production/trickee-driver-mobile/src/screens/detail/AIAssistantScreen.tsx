import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors} from '../../constants/Colors';
import DetailHeader from '../../components/DetailHeader';
import {EmptyState} from '../../components/StateViews';
import {useAuth} from '../../context/AuthContext';
import {useLiveData} from '../../context/LiveDataContext';
import {api, ApiError} from '../../services/api';
import {
  recordAssistantVoiceClip,
  transcribeVoiceClip,
} from '../../services/voiceInput';
import {
  speakAssistantReply,
  stopAssistantSpeech,
} from '../../services/voiceReply';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  isTyping?: boolean;
};

type VoicePhase = 'idle' | 'listening' | 'transcribing' | 'thinking';

const SUGGESTIONS = [
  'How much range do I have left?',
  'Where is the nearest fast charger?',
  'Is my battery healthy today?',
];

let counter = 0;
const nextId = () => `m${++counter}`;

function assistantErrorText(error: unknown) {
  return error instanceof ApiError
    ? `Sorry - ${error.message}`
    : 'Sorry, I could not reach the assistant.';
}

function voiceCaptureErrorText(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }
  return 'Could not capture voice input.';
}

const AIAssistantScreen: React.FC = () => {
  const {token} = useAuth();
  const {driver, vehicle, telemetry} = useLiveData();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: nextId(),
      role: 'assistant',
      text: "Hi! I'm your Trickee assistant. Ask me about your battery, range, or the nearest charger.",
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('idle');
  const scrollRef = useRef<ScrollView>(null);
  const typingTimers = useRef<ReturnType<typeof setInterval>[]>([]);

  const canChat = !!token && !!driver && !!vehicle;
  const voiceBusy = voicePhase !== 'idle';
  const currentLocation =
    telemetry?.lat != null && telemetry?.lng != null
      ? {lat: telemetry.lat, lng: telemetry.lng}
      : undefined;

  const scrollToEnd = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({animated: true}), 50);
  }, []);

  useEffect(() => {
    return () => {
      typingTimers.current.forEach(timer => clearInterval(timer));
      typingTimers.current = [];
      stopAssistantSpeech();
    };
  }, []);

  const appendAssistantMessage = useCallback(
    (text: string, animated = false) => {
      if (!animated) {
        setMessages(prev => [...prev, {id: nextId(), role: 'assistant', text}]);
        scrollToEnd();
        return Promise.resolve();
      }

      const messageId = nextId();
      setMessages(prev => [
        ...prev,
        {id: messageId, role: 'assistant', text: '', isTyping: true},
      ]);
      scrollToEnd();

      return new Promise<void>(resolve => {
        let index = 0;
        const timer = setInterval(() => {
          index = Math.min(index + 2, text.length);
          setMessages(prev =>
            prev.map(message =>
              message.id === messageId
                ? {
                    ...message,
                    text: text.slice(0, index),
                    isTyping: index < text.length,
                  }
                : message,
            ),
          );
          if (index >= text.length) {
            clearInterval(timer);
            typingTimers.current = typingTimers.current.filter(
              item => item !== timer,
            );
            resolve();
          }
        }, 18);
        typingTimers.current.push(timer);
      });
    },
    [scrollToEnd],
  );

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending || voiceBusy || !canChat) {
      return;
    }
    setInput('');
    setMessages(prev => [...prev, {id: nextId(), role: 'user', text: trimmed}]);
    setSending(true);
    scrollToEnd();
    try {
      const reply = await api.assistantMessage(token!, {
        driver_id: driver!.id,
        vehicle_id: vehicle!.id,
        message: trimmed,
        location: currentLocation,
      });
      await appendAssistantMessage(reply.answer, false);
    } catch (error) {
      await appendAssistantMessage(assistantErrorText(error), false);
    } finally {
      setSending(false);
      scrollToEnd();
    }
  };

  const listenAndSend = async () => {
    if (sending || voiceBusy || !canChat) {
      return;
    }
    setVoicePhase('listening');
    try {
      const audioUri = await recordAssistantVoiceClip();
      setVoicePhase('transcribing');
      const transcript = await transcribeVoiceClip(token!, audioUri);
      setMessages(prev => [
        ...prev,
        {id: nextId(), role: 'user', text: transcript},
      ]);
      scrollToEnd();

      setVoicePhase('thinking');
      setSending(true);
      const reply = await api.voiceCopilot(token!, {
        transcript,
        vehicle_id: vehicle!.id,
        current_location: currentLocation,
      });
      const replyText = reply.voice_response || reply.answer;
      speakAssistantReply(replyText);
      await appendAssistantMessage(replyText, true);
    } catch (error) {
      await stopAssistantSpeech();
      await appendAssistantMessage(voiceCaptureErrorText(error), false);
    } finally {
      setSending(false);
      setVoicePhase('idle');
      scrollToEnd();
    }
  };

  const voiceStatus =
    voicePhase === 'listening'
      ? 'Listening for 7 seconds...'
      : voicePhase === 'transcribing'
      ? 'Transcribing voice...'
      : voicePhase === 'thinking'
      ? 'Understanding intent...'
      : null;

  return (
    <View style={styles.container}>
      <DetailHeader
        title="AI Assistant"
        subtitle="Grounded in live fleet data"
      />
      {!canChat ? (
        <EmptyState
          icon="robot-confused"
          title="Assistant unavailable"
          subtitle="Your driver and vehicle need to be linked before you can chat."
        />
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.messages}
            showsVerticalScrollIndicator={false}>
            {messages.map(m => (
              <View
                key={m.id}
                style={[
                  styles.bubble,
                  m.role === 'user'
                    ? styles.userBubble
                    : styles.assistantBubble,
                ]}>
                <Text
                  style={
                    m.role === 'user' ? styles.userText : styles.assistantText
                  }>
                  {m.text}
                  {m.isTyping ? '|' : ''}
                </Text>
              </View>
            ))}
            {(sending || voiceBusy) && (
              <View
                style={[styles.bubble, styles.assistantBubble, styles.typing]}>
                <ActivityIndicator size="small" color={Colors.trickeeYellow} />
                {voiceStatus ? (
                  <Text style={styles.statusText}>{voiceStatus}</Text>
                ) : null}
              </View>
            )}
            {messages.length <= 1 && (
              <View style={styles.suggestions}>
                {SUGGESTIONS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={styles.suggestionChip}
                    onPress={() => send(s)}>
                    <Text style={styles.suggestionText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Ask about battery, range, chargers..."
              placeholderTextColor="rgba(156,163,175,0.6)"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => send(input)}
              returnKeyType="send"
              editable={!sending && !voiceBusy}
            />
            <TouchableOpacity
              style={[
                styles.micButton,
                voiceBusy && styles.micButtonActive,
                (sending || !canChat) && styles.sendDisabled,
              ]}
              onPress={listenAndSend}
              disabled={sending || voiceBusy || !canChat}>
              {voiceBusy ? (
                <ActivityIndicator size="small" color={Colors.buttonText} />
              ) : (
                <Icon name="microphone" size={20} color={Colors.buttonText} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!input.trim() || sending || voiceBusy) && styles.sendDisabled,
              ]}
              onPress={() => send(input)}
              disabled={!input.trim() || sending || voiceBusy}>
              <Icon name="send" size={20} color={Colors.buttonText} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.appBackground},
  flex: {flex: 1},
  messages: {padding: 16, gap: 10, paddingBottom: 20},
  bubble: {
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.trickeeYellow,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderBottomLeftRadius: 4,
  },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  statusText: {fontSize: 12, color: Colors.secondaryText, fontWeight: '600'},
  userText: {
    fontSize: 14,
    color: Colors.buttonText,
    fontWeight: '600',
    lineHeight: 20,
  },
  assistantText: {fontSize: 14, color: Colors.white, lineHeight: 20},
  suggestions: {gap: 8, marginTop: 8},
  suggestionChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,202,32,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,202,32,0.25)',
  },
  suggestionText: {
    fontSize: 13,
    color: Colors.trickeeYellow,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(4,6,10,0.9)',
  },
  input: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 18,
    color: Colors.white,
    fontSize: 14,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.trickeeYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.neonBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: {backgroundColor: Colors.trickeeYellow},
  sendDisabled: {opacity: 0.5},
});

export default AIAssistantScreen;
