# Trickee Driver Mobile

Canonical React Native Android app for Trickee mobile.

This app now uses the Rohith Android UI as the mobile frontend source of truth while keeping `production/backend` as the only backend source of truth.

## Scope

- Splash and onboarding flow.
- Email/password pilot login against the Trickee backend.
- Access request signup flow.
- Home dashboard.
- Live map.
- Monitoring dashboard.
- More menu.
- AI assistant.
- Route intelligence.
- Past trips.
- Daily impact.
- Driver action sheet for trips, charging, waiting, and issue reporting.

## Backend

The app talks to the existing backend in:

```text
production/backend
```

Do not use or add a second backend inside the mobile app folder.

Local Android emulator backend origin:

```text
http://10.0.2.2:8000
```

Hosted backend origin is configured in:

```text
src/config/index.ts
```

## Run

```text
npm install
npx react-native start
npx react-native run-android
```

## Notes

- The visible UI is preserved from the Rohith Android branch.
- `USE_HOSTED_BACKEND` is currently `false`, so local emulator builds use `10.0.2.2`.
- Apple/Google login buttons are placeholders until native auth SDK wiring is added.
- FCM and background GPS from the earlier pilot app still need to be reintroduced behind this UI.
