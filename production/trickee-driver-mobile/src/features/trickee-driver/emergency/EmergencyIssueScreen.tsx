import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';

const issues = [
  ['low_battery', 'Low battery'],
  ['breakdown', 'Breakdown'],
  ['puncture', 'Puncture'],
  ['charger_not_working', 'Charger issue'],
  ['unsafe_route', 'Unsafe route'],
  ['accident', 'Accident'],
  ['need_help', 'Need help'],
] as const;

type Props = {
  onCancel: () => void;
  onSubmit: (issueType: string, message?: string) => Promise<void>;
};

export function EmergencyIssueScreen({onCancel, onSubmit}: Props) {
  const [selected, setSelected] = useState<string>('low_battery');
  const [message, setMessage] = useState('');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Help</Text>
      <View style={styles.grid}>
        {issues.map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setSelected(value)}
            style={[styles.issue, selected === value && styles.issueSelected]}>
            <Text style={[styles.issueText, selected === value && styles.issueTextSelected]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        placeholder="Message"
        placeholderTextColor="#6b7280"
        value={message}
        onChangeText={setMessage}
        style={styles.input}
      />
      <View style={styles.actions}>
        <Pressable onPress={onCancel} style={styles.secondary}>
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
        <Pressable onPress={() => onSubmit(selected, message.trim() || undefined)} style={styles.primary}>
          <Text style={styles.primaryText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#081018',
    padding: 20,
  },
  title: {
    color: '#f8fafc',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  issue: {
    borderColor: '#263445',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  issueSelected: {
    backgroundColor: '#d64545',
    borderColor: '#d64545',
  },
  issueText: {
    color: '#cbd5e1',
    fontWeight: '700',
  },
  issueTextSelected: {
    color: '#ffffff',
  },
  input: {
    backgroundColor: '#111b25',
    borderColor: '#263445',
    borderWidth: 1,
    borderRadius: 8,
    color: '#f8fafc',
    fontSize: 16,
    marginTop: 18,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  primary: {
    alignItems: 'center',
    backgroundColor: '#d64545',
    borderRadius: 8,
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  secondary: {
    alignItems: 'center',
    borderColor: '#263445',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryText: {
    color: '#cbd5e1',
    fontWeight: '800',
  },
});
