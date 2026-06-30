import React from 'react';
import {StatusBar, View, StyleSheet} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import {AuthProvider} from './src/context/AuthContext';
import {LiveDataProvider} from './src/context/LiveDataContext';
import ErrorBoundary from './src/components/ErrorBoundary';
import {Colors} from './src/constants/Colors';

const App: React.FC = () => {
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AuthProvider>
            <LiveDataProvider>
              <StatusBar
                translucent
                backgroundColor="transparent"
                barStyle="light-content"
              />
              <View style={styles.container}>
                <NavigationContainer>
                  <AppNavigator />
                </NavigationContainer>
              </View>
            </LiveDataProvider>
          </AuthProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.appBackground,
  },
});

export default App;
