import {Platform} from 'react-native';

export const Typography = {
  fontFamily: {
    regular: Platform.OS === 'android' ? 'Roboto' : 'System',
    medium: Platform.OS === 'android' ? 'Roboto-Medium' : 'System',
    bold: Platform.OS === 'android' ? 'Roboto-Bold' : 'System',
    black: Platform.OS === 'android' ? 'Roboto-Black' : 'System',
  },
  fontSize: {
    xs: 10,
    sm: 11,
    md: 13,
    base: 14,
    lg: 15,
    xl: 16,
    '2xl': 18,
    '3xl': 22,
    '4xl': 24,
    '5xl': 26,
    '6xl': 28,
    '7xl': 32,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
    black: '900' as const,
  },
  letterSpacing: {
    tight: 0.5,
    normal: 1,
    wide: 1.5,
    wider: 4,
  },
};
