# Trickee Driver Mobile

React Native CLI Android pilot app for the Trickee Action Button workflow.

## Scope

- Supabase email/password login.
- Backend approval check through `GET /api/v1/mobile/me`.
- Location and notification permission setup.
- FCM token registration through `POST /api/v1/auth/fcm-token`.
- Action Button gestures:
  - single tap: voice destination and trip start
  - double tap: charging start
  - swipe right: waiting start
  - long press: issue screen
- Phone GPS pings through `POST /api/v1/mobile/location`.
- Offline event queue for retryable POST events.

## Environment

Set these values before running the app:

```text
TRICKEE_BACKEND_URL=http://10.0.2.2:8000/api/v1
TRICKEE_SUPABASE_URL=<supabase-url>
TRICKEE_SUPABASE_ANON_KEY=<supabase-anon-key>
TRICKEE_LOCATION_INTERVAL_MS=30000
```

Do not place service-role, Google, Gemini, OpenAI, Groq, or privileged map keys in this app.

## Run

```text
npm install
npx react-native run-android
```

Firebase Android config is intentionally not committed here. Add the pilot `google-services.json` through the secure app distribution setup when Firebase Cloud Messaging is configured.
