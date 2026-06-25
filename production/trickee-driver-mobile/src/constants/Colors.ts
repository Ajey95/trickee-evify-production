// Exact color values extracted from iOS .colorset files
// TrickeeYellow: R:1.000 G:0.792 B:0.125 → #FFCA20
// LaunchBackground: R:0.043 G:0.075 B:0.145 → #0B1325
// OnboardingBackground: R:0.043 G:0.075 B:0.145 → #0B1325
// CardBackground: R:0.086 G:0.133 B:0.247 → #16223F
// SecondaryText: R:0.612 G:0.639 B:0.686 → #9CA3AF

export const Colors = {
  // Primary brand
  trickeeYellow: '#FFCA20',
  accent: '#FFCA20',

  // Backgrounds
  launchBackground: '#0B1325',
  onboardingBackground: '#0B1325',
  cardBackground: '#16223F',
  appBackground: '#04060A',

  // Glass card
  glassCardStart: 'rgba(17, 20, 24, 0.85)',
  glassCardEnd: 'rgba(23, 27, 34, 0.85)',

  // Text
  primaryText: '#FFFFFF',
  secondaryText: '#9CA3AF',
  darkText: '#0B1325',

  // UI
  white: '#FFFFFF',
  black: '#000000',
  neonGreen: '#39FF14',
  neonPurple: '#BD00FF',
  neonBlue: '#00E5FF',
  greenAccent: '#33CC80',
  moderateYellow: '#FFCC00',
  red: '#FF4444',

  // Button text color on yellow bg (from iOS: Color(red: 0.043, green: 0.075, blue: 0.145))
  buttonText: '#0B1325',

  // Additional accent colors (from iOS)
  neonPink: '#FF3366',
  neonCyan: '#00E5FF',
  redSoft: '#FF8A80',

  // Premium card system (iOS PremiumCardModifier)
  premiumCardBg: 'rgba(17, 20, 24, 0.85)',
  premiumCardBorder: 'rgba(255, 255, 255, 0.12)',
  premiumCardInnerBorder: 'rgba(255, 255, 255, 0.06)',
  premiumCardHighlight: 'rgba(255, 255, 255, 0.08)',

  // Liquid glass system (iOS LiquidGlassModifier)
  liquidGlassBg: 'rgba(255, 255, 255, 0.04)',
  liquidGlassBorder: 'rgba(255, 255, 255, 0.18)',
  liquidGlassHighlight: 'rgba(255, 255, 255, 0.08)',

  // Borders & subtle
  borderSubtle: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.15)',
  borderFocus: 'rgba(255, 202, 32, 0.6)',
  overlay: 'rgba(255, 255, 255, 0.04)',
};
