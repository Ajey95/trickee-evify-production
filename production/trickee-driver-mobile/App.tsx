import React, {useEffect, useState} from 'react';
import {ActivityIndicator, StatusBar, StyleSheet, Text, View, useColorScheme} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';

import {LoginScreen} from './src/features/trickee-driver/auth/LoginScreen';
import {DriverHomeScreen} from './src/features/trickee-driver/action-button/DriverHomeScreen';
import {PermissionSetupScreen} from './src/features/trickee-driver/location/PermissionSetupScreen';
import {getSession} from './src/services/trickeeAuth/supabaseClient';
import {trickeeApi} from './src/services/trickeeApi/client';

type Screen = 'boot' | 'login' | 'pending' | 'permissions' | 'home';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [screen, setScreen] = useState<Screen>('boot');
  const [pendingMessage, setPendingMessage] = useState('Waiting for admin approval.');

  async function bootstrap() {
    const session = await getSession();
    if (!session) {
      setScreen('login');
      return;
    }
    const me = await trickeeApi.mobileMe();
    if (me.success) {
      setScreen('permissions');
      return;
    }
    setPendingMessage(me.error || 'Waiting for admin approval.');
    setScreen('pending');
  }

  useEffect(() => {
    bootstrap();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={styles.safe}>
        {screen === 'boot' ? (
          <View style={styles.center}>
            <ActivityIndicator color="#16c7b8" />
          </View>
        ) : null}
        {screen === 'login' ? <LoginScreen onSignedIn={bootstrap} /> : null}
        {screen === 'pending' ? (
          <View style={styles.center}>
            <Text style={styles.pending}>{pendingMessage}</Text>
          </View>
        ) : null}
        {screen === 'permissions' ? <PermissionSetupScreen onReady={() => setScreen('home')} /> : null}
        {screen === 'home' ? <DriverHomeScreen /> : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: '#081018',
    flex: 1,
  },
  center: {
    alignItems: 'center',
    backgroundColor: '#081018',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  pending: {
    color: '#cbd5e1',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default App;
