import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  StatusBar,
  Dimensions,
  Easing,
  Image,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Colors} from '../constants/Colors';
import {useAuth} from '../context/AuthContext';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

type SplashScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

const SplashScreen: React.FC<SplashScreenProps> = ({navigation}) => {
  const {restore} = useAuth();
  // Animation values
  const carX = useRef(new Animated.Value(-200)).current;
  const wheelRotation = useRef(new Animated.Value(0)).current;
  const roadOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.4)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const loaderOpacity = useRef(new Animated.Value(0)).current;
  const spinnerRotation = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const chargingGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    StatusBar.setBarStyle('light-content');
    StatusBar.setBackgroundColor(Colors.onboardingBackground);

    // Step 1: Car drives in from left (0-1.5s) — iOS: spring(response:0.5, damping:0.7)
    Animated.parallel([
      Animated.spring(carX, {
        toValue: 0,
        damping: 14,
        stiffness: 90,
        useNativeDriver: true,
      }),
      Animated.timing(wheelRotation, {
        toValue: 720,
        duration: 1500,
        useNativeDriver: true,
      }),
    ]).start();

    // Step 2: Lightning flash at 1.5s — iOS: flash opacity 0→0.3→0 in 80ms/150ms
    setTimeout(() => {
      Animated.sequence([
        Animated.timing(flashOpacity, {
          toValue: 0.3,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(flashOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.timing(chargingGlow, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, 1500);

    // Step 3: Car speeds off to right at 2.2s — iOS: easeIn(duration: 0.8)
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(carX, {
          toValue: SCREEN_WIDTH + 200,
          duration: 800,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(wheelRotation, {
          toValue: 2200,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();

      // Hide road
      setTimeout(() => {
        Animated.timing(roadOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }, 600);
    }, 2200);

    // Step 4: Logo zooms in at 3.0s — iOS: spring(response:0.5, damping:0.65)
    setTimeout(() => {
      Animated.spring(logoScale, {
        toValue: 1,
        damping: 8,
        stiffness: 120,
        useNativeDriver: true,
      }).start();
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, 3000);

    // Step 5: Loader appears at 3.6s — iOS: appears ~0.6s after logo
    setTimeout(() => {
      Animated.timing(loaderOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      // Spin loader continuously
      Animated.loop(
        Animated.timing(spinnerRotation, {
          toValue: 360,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    }, 3600);

    // Step 6: Navigate at 5.0s — iOS: logo 1.0→1.3 scale, fade out
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1.3,
          damping: 15,
          stiffness: 100,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(loaderOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(async () => {
        const hasSession = await restore();
        navigation.replace(hasSession ? 'Main' : 'Onboarding');
      });
    }, 5000);
  }, [
    navigation,
    restore,
    carX,
    wheelRotation,
    roadOpacity,
    logoScale,
    logoOpacity,
    loaderOpacity,
    spinnerRotation,
    flashOpacity,
    chargingGlow,
  ]);

  const wheelSpin = wheelRotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  const spinnerSpin = spinnerRotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      {/* Flash overlay */}
      <Animated.View style={[styles.flashOverlay, {opacity: flashOpacity}]} />

      {/* Logo */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [{scale: logoScale}],
            opacity: logoOpacity,
          },
        ]}>
        <View style={styles.logoCircle}>
          <Image
            source={require('../trickee_logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.logoLabel}>TRICKEE</Text>
      </Animated.View>

      {/* Road + Car scene */}
      <Animated.View style={[styles.sceneContainer, {opacity: roadOpacity}]}>
        {/* Road */}
        <View style={styles.road}>
          <View style={styles.roadDashes} />
          <View style={styles.roadCurb} />
        </View>

        {/* Car */}
        <Animated.View
          style={[styles.carContainer, {transform: [{translateX: carX}]}]}>
          {/* Car body */}
          <Animated.View
            style={[
              styles.carBody,
              chargingGlow.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              })
                ? styles.carBodyCharged
                : null,
            ]}>
            {/* Windows */}
            <View style={styles.carRoof} />
            <View style={styles.carWindows}>
              <View style={styles.carWindowFront} />
              <View style={styles.carWindowBack} />
            </View>
            {/* Headlight */}
            <View style={styles.headlight} />
            {/* Taillight */}
            <View style={styles.taillight} />
          </Animated.View>

          {/* Wheels */}
          <View style={styles.wheelsRow}>
            <Animated.View
              style={[styles.wheel, {transform: [{rotate: wheelSpin}]}]}>
              <View style={styles.wheelInner} />
              <View style={styles.wheelSpoke1} />
              <View style={styles.wheelSpoke2} />
            </Animated.View>
            <Animated.View
              style={[styles.wheel, {transform: [{rotate: wheelSpin}]}]}>
              <View style={styles.wheelInner} />
              <View style={styles.wheelSpoke1} />
              <View style={styles.wheelSpoke2} />
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Bottom loader */}
      <Animated.View style={[styles.loaderContainer, {opacity: loaderOpacity}]}>
        <View style={styles.spinnerOuter}>
          <Animated.View
            style={[styles.spinnerArc, {transform: [{rotate: spinnerSpin}]}]}>
            <View style={styles.spinnerArcFill} />
          </Animated.View>
        </View>
        <Text style={styles.connectingText}>CONNECTING</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#04060A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.trickeeYellow,
    zIndex: 10,
  },
  logoContainer: {
    alignItems: 'center',
    gap: 16,
    position: 'absolute',
    top: '35%',
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 202, 32, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 202, 32, 0.3)',
  },
  logoImage: {
    width: '65%',
    height: '65%',
  },
  logoLabel: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.trickeeYellow,
    letterSpacing: 6,
  },
  sceneContainer: {
    position: 'absolute',
    bottom: '25%',
    width: '100%',
    height: 120,
    justifyContent: 'flex-end',
  },
  road: {
    width: '100%',
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
  },
  roadDashes: {
    width: '100%',
    height: 2.5,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 1,
  },
  roadCurb: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  carContainer: {
    position: 'absolute',
    bottom: 15,
    left: '35%',
    width: 120,
    height: 65,
  },
  carBody: {
    width: 120,
    height: 45,
    backgroundColor: 'rgba(13, 18, 31, 0.95)',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    overflow: 'hidden',
  },
  carBodyCharged: {
    borderColor: Colors.trickeeYellow,
    shadowColor: Colors.trickeeYellow,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  carRoof: {
    position: 'absolute',
    top: -8,
    left: 25,
    width: 55,
    height: 18,
    backgroundColor: 'rgba(13, 18, 31, 0.95)',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderBottomWidth: 0,
  },
  carWindows: {
    flexDirection: 'row',
    position: 'absolute',
    top: 2,
    left: 28,
    gap: 3,
  },
  carWindowFront: {
    width: 22,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 2,
  },
  carWindowBack: {
    width: 18,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 2,
  },
  headlight: {
    position: 'absolute',
    left: 2,
    top: 18,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.trickeeYellow,
  },
  taillight: {
    position: 'absolute',
    right: 2,
    top: 18,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF4444',
  },
  wheelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  wheel: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#141414',
    borderWidth: 1.5,
    borderColor: 'rgba(128, 128, 128, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#888',
  },
  wheelSpoke1: {
    position: 'absolute',
    width: 2,
    height: 18,
    backgroundColor: 'rgba(128, 128, 128, 0.8)',
    borderRadius: 1,
  },
  wheelSpoke2: {
    position: 'absolute',
    width: 18,
    height: 2,
    backgroundColor: 'rgba(128, 128, 128, 0.8)',
    borderRadius: 1,
  },
  loaderContainer: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
    gap: 16,
  },
  spinnerOuter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerArc: {
    width: 36,
    height: 36,
    position: 'absolute',
  },
  spinnerArcFill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: Colors.trickeeYellow,
    borderRightColor: Colors.trickeeYellow,
  },
  connectingText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.secondaryText,
    letterSpacing: 4,
  },
});

export default SplashScreen;
