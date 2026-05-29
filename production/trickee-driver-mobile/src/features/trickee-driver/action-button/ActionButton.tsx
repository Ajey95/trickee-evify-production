import React, {useMemo, useRef} from 'react';
import {Animated, PanResponder, Pressable, StyleSheet, Text, Vibration, View} from 'react-native';

import type {MobileState} from '../types';

type Props = {
  state: MobileState;
  onTap: () => void;
  onDoubleTap: () => void;
  onSwipeRight: () => void;
  onLongPress: () => void;
};

const labels: Record<MobileState, string> = {
  ready: 'Start',
  listening: 'Listening...',
  trip_active: 'Trip Active',
  waiting: 'Waiting',
  charging: 'Charging',
  emergency: 'Help',
};

export function ActionButton({state, onTap, onDoubleTap, onSwipeRight, onLongPress}: Props) {
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragX = useRef(new Animated.Value(0)).current;
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 16 && Math.abs(gesture.dy) < 24,
        onPanResponderMove: Animated.event([null, {dx: dragX}], {useNativeDriver: false}),
        onPanResponderRelease: (_, gesture) => {
          Animated.spring(dragX, {toValue: 0, useNativeDriver: true}).start();
          if (gesture.dx > 80) {
            Vibration.vibrate(35);
            onSwipeRight();
          }
        },
      }),
    [dragX, onSwipeRight],
  );

  function handlePress() {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
      }
      lastTap.current = 0;
      Vibration.vibrate(45);
      onDoubleTap();
      return;
    }
    lastTap.current = now;
    tapTimer.current = setTimeout(() => {
      lastTap.current = 0;
      Vibration.vibrate(20);
      onTap();
    }, 260);
  }

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.buttonShadow, {transform: [{translateX: dragX}]}]} {...panResponder.panHandlers}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Trickee action button"
          delayLongPress={1200}
          onLongPress={() => {
            Vibration.vibrate([0, 80, 60, 120]);
            onLongPress();
          }}
          onPress={handlePress}
          style={({pressed}) => [styles.button, styles[state], pressed && styles.pressed]}>
          <Text style={styles.label}>{labels[state]}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  buttonShadow: {
    shadowColor: '#0a0f14',
    shadowOffset: {width: 0, height: 18},
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 8,
  },
  button: {
    width: 188,
    height: 188,
    borderRadius: 94,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  ready: {backgroundColor: '#0fb9b1'},
  listening: {backgroundColor: '#276ef1'},
  trip_active: {backgroundColor: '#1b7f4d'},
  waiting: {backgroundColor: '#d89112'},
  charging: {backgroundColor: '#6b8f22'},
  emergency: {backgroundColor: '#d64545'},
  pressed: {
    transform: [{scale: 0.98}],
  },
  label: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
});
