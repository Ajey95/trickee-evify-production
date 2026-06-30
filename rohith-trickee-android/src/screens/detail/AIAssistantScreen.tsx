import React, {useRef, useState} from 'react';
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
import BackgroundLogo from '../../components/BackgroundLogo';
import {EmptyState} from '../../components/StateViews';
import {useAuth} from '../../context/AuthContext';
import {useLiveData} from '../../context/LiveDataContext';
import {api, ApiError} from '../../services/api';

type ChatMessage = {id: string; role: 'user' | 'assistant'; text: string};

const SUGGESTIONS = [
  'How much range do I have left?',
  'Where is the nearest fast charger?',
  'Is my battery healthy today?',
];

let counter = 0;
const nextId = () => `m${++counter}`;

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
  const scrollRef = useRef<ScrollView>(null);

  const canChat = !!token && !!driver && !!vehicle;

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending || !canChat) {
      return;
    }
    setInput('');
    setMessages(prev => [...prev, {id: nextId(), role: 'user', text: trimmed}]);
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({animated: true}), 50);
    try {
      const reply = await api.assistantMessage(token!, {
        driver_id: driver!.id,
        vehicle_id: vehicle!.id,
        message: trimmed,
        location:
          telemetry?.lat != null && telemetry?.lng != null
            ? {lat: telemetry.lat, lng: telemetry.lng}
            : undefined,
      });
      setMessages(prev => [
        ...prev,
        {id: nextId(), role: 'assistant', text: reply.answer},
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: nextId(),
          role: 'assistant',
          text:
            err instanceof ApiError
              ? `Sorry — ${err.message}`
              : 'Sorry, I could not reach the assistant.',
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({animated: true}), 50);
    }
  };

  return (
    <View style={styles.container}>
      <BackgroundLogo />
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
                </Text>
              </View>
            ))}
            {sending && (
              <View
                style={[styles.bubble, styles.assistantBubble, styles.typing]}>
                <ActivityIndicator size="small" color={Colors.trickeeYellow} />
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
              placeholder="Ask about battery, range, chargers…"
              placeholderTextColor="rgba(156,163,175,0.6)"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => send(input)}
              returnKeyType="send"
              editable={!sending}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!input.trim() || sending) && styles.sendDisabled,
              ]}
              onPress={() => send(input)}
              disabled={!input.trim() || sending}>
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
  typing: {paddingVertical: 14, paddingHorizontal: 20},
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
  sendDisabled: {opacity: 0.5},
});

export default AIAssistantScreen;
