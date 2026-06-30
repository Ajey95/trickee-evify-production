import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import AuthScreen from '../screens/AuthScreen';
import MainTabNavigator from './MainTabNavigator';
import AIAssistantScreen from '../screens/detail/AIAssistantScreen';
import RouteIntelScreen from '../screens/detail/RouteIntelScreen';
import PastTripsScreen from '../screens/detail/PastTripsScreen';
import DailyImpactScreen from '../screens/detail/DailyImpactScreen';

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Auth: undefined;
  Main: undefined;
  AIAssistant: undefined;
  RouteIntel: undefined;
  PastTrips: undefined;
  DailyImpact: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: {backgroundColor: '#04060A'},
      }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Auth" component={AuthScreen} />
      <Stack.Screen name="Main" component={MainTabNavigator} />
      {/* Detail screens (pushed from the More menu) use a slide animation. */}
      <Stack.Group screenOptions={{animation: 'slide_from_right'}}>
        <Stack.Screen name="AIAssistant" component={AIAssistantScreen} />
        <Stack.Screen name="RouteIntel" component={RouteIntelScreen} />
        <Stack.Screen name="PastTrips" component={PastTripsScreen} />
        <Stack.Screen name="DailyImpact" component={DailyImpactScreen} />
      </Stack.Group>
    </Stack.Navigator>
  );
};

export default AppNavigator;
