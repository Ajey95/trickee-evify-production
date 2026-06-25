import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Platform} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Colors} from '../constants/Colors';
import HomeScreen from '../screens/home/HomeScreen';
import LiveMapScreen from '../screens/home/LiveMapScreen';
import MonitoringScreen from '../screens/home/MonitoringScreen';
import MoreMenuScreen from '../screens/home/MoreMenuScreen';
import LiquidGlassTabBar from '../components/LiquidGlassTabBar';
import {useAuth} from '../context/AuthContext';
import {useLiveData} from '../context/LiveDataContext';

const Tab = createBottomTabNavigator();

type MainTabNavigatorProps = {
  navigation: NativeStackNavigationProp<any>;
};

const MainTabNavigator: React.FC<MainTabNavigatorProps> = ({navigation}) => {
  const {logout} = useAuth();

  const handleLogout = async () => {
    await logout();
    navigation.replace('Auth');
  };

  // Map MoreMenu item ids → root-stack detail routes.
  const handleNavigate = (screen: string) => {
    const routeByMenu: Record<string, string> = {
      aiIntel: 'AIAssistant',
      routeIntel: 'RouteIntel',
      pastTrips: 'PastTrips',
      dailyImpact: 'DailyImpact',
    };
    const route = routeByMenu[screen];
    if (route) {
      navigation.navigate(route);
    }
  };

  return (
    <View style={styles.container}>
      <Tab.Navigator
        tabBar={props => <LiquidGlassTabBar {...props} />}
        screenOptions={{headerShown: false}}>
        <Tab.Screen
          name="Home"
          options={{
            tabBarIcon: ({color, size}) => (
              <Icon name="home" size={size} color={color} />
            ),
            header: () => <HeaderBar title="TRICKEE" showSubtitle={false} />,
            headerShown: true,
          }}>
          {() => <HomeScreen />}
        </Tab.Screen>

        <Tab.Screen
          name="Live Map"
          options={{
            tabBarIcon: ({color, size}) => (
              <Icon name="map" size={size} color={color} />
            ),
            header: () => (
              <HeaderBar title="TRICKEE" subtitle="Fleet Operations" />
            ),
            headerShown: true,
          }}>
          {() => <LiveMapScreen />}
        </Tab.Screen>

        <Tab.Screen
          name="Monitoring"
          options={{
            tabBarIcon: ({color, size}) => (
              <Icon name="gauge" size={size} color={color} />
            ),
            header: () => (
              <HeaderBar title="TRICKEE" subtitle="Fleet Operations" />
            ),
            headerShown: true,
          }}>
          {() => <MonitoringScreen />}
        </Tab.Screen>

        <Tab.Screen
          name="More"
          options={{
            tabBarIcon: ({color, size}) => (
              <Icon name="menu" size={size} color={color} />
            ),
            header: () => (
              <HeaderBar title="TRICKEE" subtitle="Fleet Operations" />
            ),
            headerShown: true,
          }}>
          {() => (
            <MoreMenuScreen
              onNavigate={handleNavigate}
              onLogout={handleLogout}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </View>
  );
};

// Header bar with a live alert badge. Rendered inside LiveDataProvider so it
// can read the unresolved-alert count; uses the tab navigator to switch tabs.
const HeaderBar: React.FC<{
  title: string;
  subtitle?: string;
  showSubtitle?: boolean;
}> = ({title, subtitle, showSubtitle = true}) => {
  const insets = useSafeAreaInsets();
  const tabNav = useNavigation<any>();
  const {alerts} = useLiveData();

  // Safety check for alerts
  const unresolved = (alerts || []).filter(a => !a.is_resolved).length;

  return (
    <View
      style={[
        headerStyles.container,
        {
          paddingTop: Math.max(insets.top, 16),
          height: (Platform.OS === 'ios' ? 64 : 70) + insets.top,
        },
      ]}>
      <View style={headerStyles.titleBlock}>
        <Text style={headerStyles.title}>{title}</Text>
        {showSubtitle && subtitle && (
          <Text style={headerStyles.subtitle}>{subtitle}</Text>
        )}
      </View>
      <View style={headerStyles.actions}>
        <TouchableOpacity
          style={headerStyles.iconButton}
          onPress={() => tabNav.navigate('Monitoring')}>
          <Icon name="bell-outline" size={22} color={Colors.white} />
          {unresolved > 0 && (
            <View style={headerStyles.badge}>
              <Text style={headerStyles.badgeText}>
                {unresolved > 9 ? '9+' : unresolved}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={headerStyles.iconButton}
          onPress={() => tabNav.navigate('More')}>
          <Icon name="account-circle" size={26} color={Colors.trickeeYellow} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const headerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#04060A', // Solid background to avoid semi-transparent artifacts
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  titleBlock: {justifyContent: 'center'},
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.trickeeYellow,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: -2,
  },
  actions: {flexDirection: 'row', gap: 8},
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#04060A',
  },
  badgeText: {fontSize: 8, fontWeight: '900', color: Colors.white},
});

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.appBackground},
  tabBar: {
    backgroundColor: Colors.appBackground,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 8,
    height: Platform.OS === 'ios' ? 90 : 70,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: Platform.OS === 'ios' ? 0 : 10,
  },
});

export default MainTabNavigator;
