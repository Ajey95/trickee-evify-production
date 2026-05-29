import React, {useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';

import {signInWithEmail} from '../../../services/trickeeAuth/supabaseClient';

type Props = {
  onSignedIn: () => Promise<void>;
};

export function LoginScreen({onSignedIn}: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(undefined);
    try {
      await signInWithEmail(email.trim(), password);
      await onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Trickee Driver</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor="#6b7280"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <TextInput
        placeholder="Password"
        placeholderTextColor="#6b7280"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={loading || !email || !password} onPress={submit} style={styles.button}>
        {loading ? <ActivityIndicator color="#061014" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#081018',
  },
  brand: {
    color: '#f8fafc',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 28,
  },
  input: {
    backgroundColor: '#111b25',
    borderColor: '#263445',
    borderWidth: 1,
    borderRadius: 8,
    color: '#f8fafc',
    fontSize: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  error: {
    color: '#f87171',
    marginBottom: 12,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#16c7b8',
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#061014',
    fontSize: 16,
    fontWeight: '800',
  },
});
