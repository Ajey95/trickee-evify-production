import React, {useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';

import {ensureBackgroundLocationPermission, ensureLocationPermission} from '../../../services/trickeeLocation/locationService';
import {registerFcmToken} from '../../../services/trickeeNotifications/fcm';

type Props = {
  onReady: () => void;
};

export function PermissionSetupScreen({onReady}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function requestPermissions() {
    setLoading(true);
    setError(undefined);
    try {
      const fineLocation = await ensureLocationPermission();
      const backgroundLocation = await ensureBackgroundLocationPermission();
      await registerFcmToken();
      if (!fineLocation || !backgroundLocation) {
        setError('Location permission is still missing.');
        return;
      }
      onReady();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Permission setup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Location and alerts</Text>
      <Text style={styles.body}>
        Trickee uses location during rides to keep your fleet map, battery alerts, and charging suggestions accurate.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={loading} onPress={requestPermissions} style={styles.button}>
        {loading ? <ActivityIndicator color="#061014" /> : <Text style={styles.buttonText}>Continue</Text>}
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
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 14,
  },
  body: {
    color: '#cbd5e1',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 18,
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
