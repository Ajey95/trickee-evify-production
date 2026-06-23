# TrickeeAndroid — React Native

A pixel-perfect React Native rebuild of the Trickee iOS SwiftUI app for Android.

## Prerequisites

- Node.js >= 18
- JDK 17
- Android Studio with SDK 34
- Android Emulator or physical device

## Setup

```bash
npm install
```

## Run

```bash
# Start Metro bundler
npx react-native start

# In another terminal
npx react-native run-android
```

## Project Structure

```
src/
├── assets/          # Images, icons
├── constants/       # Colors, Typography, Spacing
├── components/      # Reusable UI components
├── navigation/      # React Navigation setup
├── screens/         # All app screens
│   ├── SplashScreen.tsx
│   ├── OnboardingScreen.tsx
│   ├── AuthScreen.tsx
│   └── home/
│       ├── HomeScreen.tsx
│       ├── LiveMapScreen.tsx
│       ├── MonitoringScreen.tsx
│       └── MoreMenuScreen.tsx
└── theme/           # Theme exports
```

## Screens

1. **Splash** — Cinematic EV car animation with lightning charge
2. **Onboarding** — 3 swipeable pages with glassmorphic cards
3. **Auth** — Sign In + 2-step Sign Up with validation
4. **Home** — Fleet dashboard with orders, alerts, driver archetypes
5. **Live Map** — Charger network and route optimization
6. **Monitoring** — Telemetry, energy charts, vehicle health
7. **More** — Profile, fleet controls, settings

## Colors (from iOS Assets)

| Color | Hex |
|-------|-----|
| TrickeeYellow | #FFCA20 |
| LaunchBackground | #0B1325 |
| CardBackground | #16223F |
| SecondaryText | #9CA3AF |
| AppBackground | #04060A |
