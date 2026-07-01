import React from 'react';
import {Image, StyleSheet, View} from 'react-native';
import {Colors} from '../constants/Colors';

interface BackgroundLogoProps {
  opacity?: number;
  offsetY?: number;
}

const BackgroundLogo: React.FC<BackgroundLogoProps> = ({
  opacity = 0.07,
  offsetY = -40,
}) => (
  <View style={styles.wrap} pointerEvents="none">
    <View style={[styles.glow, {transform: [{translateY: offsetY}]}]} />
    <Image
      source={require('../trickee_logo.png')}
      style={[styles.image, {opacity, transform: [{translateY: offsetY}]}]}
      resizeMode="contain"
    />
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  image: {
    width: '78%',
    height: '78%',
  },
  glow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: Colors.trickeeYellow,
    opacity: 0.05,
  },
});

export default BackgroundLogo;
