# Trickee Mobile Driver App PRD
**Status:** Pilot planning source of truth  
**Last updated:** 2026-05-28  
**Target platform:** React Native CLI Android pilot app  
**Primary user:** EV delivery rider / driver  
**Backend dependency:** Trickee FastAPI backend  
**Auth dependency:** Supabase Auth + Trickee workspace approval  

---

## 1. Executive Summary

Trickee needs a lightweight mobile driver app for pilot riders because mobile Chrome cannot guarantee reliable always-on background GPS. The current web dashboard remains the fleet/admin/operator product. The mobile app is only the driver companion app.

The app should collect rider intent with minimum friction:

- Start trip.
- Speak destination.
- Share live GPS during ride.
- Receive push alerts and nudges.
- Mark charging.
- Mark waiting.
- Report emergency or issue.
- Show current ride/battery/charger context.

The main product idea is the **Trickee Action Button**: one persistent rider control that converts simple gestures into structured mobility events.

---

## 2. Final Product Decision

Build a standalone **React Native CLI Android app** first.

Reason:

- The company already has a React Native app, so this pilot app can later be merged into their codebase.
- The pilot module can be built standalone now, then moved into the company app later with limited rewrite.
- React Native is faster to build than native Kotlin for this stage.
- Same language/runtime as the company app means Trickee auth, API, notification, location, and UI modules are easier for the company team to review and adopt.
- Firebase Cloud Messaging, Supabase Auth, Google Maps, and background location can be integrated through native modules.
- The app can be distributed through Firebase App Distribution during pilot without public Play Store release.

Native Kotlin would be stronger for pure background GPS reliability, but React Native is the better strategic choice because of future mergeability with the company app.

Final platform rule:

```text
For future merge with company app: React Native.
For maximum GPS reliability only: native Kotlin.
For Trickee pilot + future company integration: React Native CLI.
```

Do not use Expo managed workflow for this pilot unless background GPS and FCM requirements are explicitly downgraded. React Native CLI gives better native control for foreground services, background location, FCM, Android permissions, and later merge into an existing company app.

---

## 2.1 Merge Strategy For Company App

The pilot should be written as a portable module, not as a tightly coupled one-off app.

Recommended standalone structure:

```text
Build standalone React Native pilot app
  -> keep Trickee logic inside /src/features/trickee-driver
  -> keep API/auth/location/notification services isolated
  -> keep design tokens/components reusable
  -> avoid app-global assumptions that block later copy/merge
  -> later copy screens/services into company React Native app
```

Portable module boundaries:

- `features/trickee-driver/action-button`
- `features/trickee-driver/trips`
- `features/trickee-driver/alerts`
- `features/trickee-driver/charging`
- `features/trickee-driver/waiting`
- `features/trickee-driver/emergency`
- `services/trickeeApi`
- `services/trickeeAuth`
- `services/trickeeLocation`
- `services/trickeeNotifications`
- `storage/trickeeOfflineQueue`

Rules for mergeability:

- Do not hardcode global navigation assumptions.
- Do not hardcode one app theme; expose colors/tokens.
- Do not call backend directly from UI components; keep API calls in service layer.
- Do not place FCM/location logic inside screens; keep it in services/hooks.
- Do not store secrets in the app.
- Keep package name and Firebase config replaceable.

Expected future merge:

```text
Standalone pilot app
  -> company grants React Native repo access
  -> copy Trickee feature folder + service folder
  -> map company auth/session to Trickee backend token flow
  -> connect company navigation to Trickee Driver home
  -> keep backend APIs unchanged
```

---

## 3. Distribution Plan

### Pilot Distribution

Use **Firebase App Distribution**.

Benefits:

- No public Play Store release required.
- Upload APK/AAB builds.
- Add tester emails or groups.
- Drivers receive install link.
- Easier updates than sending raw APKs manually.

### Direct APK

Use only for quick internal testing with a small group.

### Play Store

Use later for internal testing, closed testing, and production release.

---

## 4. Scope Boundary

### Mobile App Owns

- Driver login.
- Notification permission.
- Location permission.
- Foreground/background ride tracking.
- Push alert receipt.
- Action Button interactions.
- Voice destination input.
- Basic trip/charging/waiting/emergency workflows.
- Driver-facing route/charger/nudge display.

### Web Dashboard Owns

- Admin approval.
- Fleet view.
- Reports.
- Data quality.
- Model health.
- User mapping.
- Operator decision boards.
- Advanced analytics.

The mobile app must not become a full dashboard.

---

## 5. Core User Problem

EV riders need trip and charging help while moving. They cannot reliably type forms, open multiple screens, or manually log context during deliveries.

Current telemetry can show where a vehicle moved, but not always why:

- Was the rider going to a delivery?
- Was the rider waiting at pickup?
- Was the rider charging?
- Was the rider stuck in traffic?
- Was the rider in emergency mode?
- What destination was intended?

The mobile app solves this by adding a low-friction intent layer on top of GPS and vehicle telemetry.

---

## 6. Product Objective

Create the fastest possible way for a rider to tell Trickee what they are doing.

The app should make these actions feel reflexive:

- Tap to start trip.
- Speak destination instead of typing.
- Double tap to log charging.
- Swipe to mark waiting.
- Long press for help.

The app should reduce manual input while improving the quality of mobility intelligence data.

---

## 7. MVP Gesture Model

| Gesture | Action | MVP status |
|---|---|---|
| Single tap | Start trip with voice destination | Must have |
| Double tap | Charging started | Must have |
| Swipe right | Waiting started | Must have |
| Long press | Emergency / issue | Must have |
| Swipe left | End trip | Should have |
| Swipe up | Delivery mode | Later |
| Swipe down | Personal mode | Later |

Avoid adding too many gestures in v1. Four primary actions are enough for pilot.

---

## 8. Primary Mobile Screens

### 8.1 Login Screen

Requirements:

- Supabase email/password login.
- Optional Google login if Supabase provider is configured.
- Pending account state:
  - Show "Waiting for admin approval."
  - Do not allow app access before backend approval.
- Driver must be mapped by admin to an internal driver/vehicle profile before full features are available.

### 8.2 Permission Setup Screen

Shown after login if permissions are missing.

Requests:

- Notification permission.
- Fine location permission.
- Background location permission where Android version requires separate flow.
- Battery optimization exemption prompt if needed for pilot tracking.

Must explain in plain rider language:

```text
Trickee uses location during rides to keep your fleet map, battery alerts, and charging suggestions accurate.
```

### 8.3 Action Button Home

Primary screen.

Components:

- Large Action Button.
- Current state label:
  - Ready
  - Listening
  - Trip active
  - Waiting
  - Charging
  - Help
- Current SOC/range if backend has mapped vehicle telemetry.
- Current location status.
- Latest nudge/alert.
- Quick map preview.

### 8.4 Trip Active Screen

Shows:

- Destination.
- Current route summary.
- SOC/range state.
- Feasibility message.
- Nearby charger suggestion if relevant.
- End trip action.
- Waiting and charging quick actions.

### 8.5 Alerts / Nudges Screen

Shows:

- Low SOC alerts.
- Charging opportunity alerts.
- Route/range nudges.
- Driver coaching nudges.
- Emergency messages.

### 8.6 Charging Session Screen

Shows:

- Charging start time.
- Current location.
- Nearby charger guess.
- Timer.
- Manual end charging action.
- Optional SOC input if vehicle data is unavailable.

### 8.7 Waiting Session Screen

Shows:

- Wait start time.
- Idle duration.
- Location category if known.
- Charging opportunity if wait is useful.
- End waiting action.

### 8.8 Emergency / Issue Screen

Shows:

- Issue type buttons:
  - Low battery
  - Breakdown
  - Puncture
  - Charger not working
  - Unsafe route
  - Accident
  - Need help
- Current live location.
- Nearest charger/service suggestion where relevant.
- Call/share action placeholders.

---

## 9. Main User Flows

### 9.1 App Start

```text
Open app
  -> check Supabase session
  -> call backend /auth/me or /mobile/me
  -> if pending, show approval state
  -> if approved, check permissions
  -> start driver home
```

### 9.2 Permission Setup

```text
Approved driver opens app
  -> request notification permission
  -> register FCM token with backend
  -> request fine location
  -> request background location if supported
  -> start foreground location service when ride starts
```

### 9.3 Start Trip With Voice

```text
Single tap Action Button
  -> haptic feedback
  -> app says/prompts "Where are you going?"
  -> record short voice input
  -> speech-to-text
  -> send text/current GPS to backend
  -> backend resolves destination with Maps/AI
  -> app shows destination confirmation if confidence is low
  -> backend starts trip
  -> app starts/continues location service
```

### 9.4 Charging Started

```text
Double tap Action Button
  -> haptic feedback
  -> capture GPS
  -> backend checks nearby chargers
  -> create charging session
  -> show charging timer
```

### 9.5 Waiting Started

```text
Swipe right Action Button
  -> capture GPS
  -> create waiting event
  -> track idle duration
  -> backend classifies wait when possible
  -> if useful wait + low SOC + charger nearby, send charging suggestion
```

### 9.6 Emergency / Issue

```text
Long press Action Button
  -> strong haptic feedback
  -> open issue screen
  -> capture GPS
  -> rider selects/speaks issue
  -> backend logs issue
  -> app shows next action
```

---

## 10. Background Location Requirement

The app needs stronger GPS behavior than mobile Chrome.

Required behavior:

- While trip is active, collect location at controlled intervals.
- Keep a foreground service notification visible during active tracking.
- Queue location updates offline.
- Flush queued updates when network returns.
- Stop or reduce tracking when trip ends.

Important Android reality:

- Reliable background tracking requires native foreground service behavior.
- Battery optimization may still affect some devices.
- The app must be transparent to users with a visible notification while tracking.

Recommended library options:

1. `react-native-background-geolocation`
   - Most robust.
   - Commercial license may apply.
   - Best for serious pilot reliability.

2. `react-native-geolocation-service` plus foreground service setup
   - Lower cost.
   - More engineering work.
   - Reliability depends on implementation.

MVP recommendation:

- Use the robust background geolocation library if budget allows.
- If not, implement foreground service with periodic GPS pings and offline queue.

---

## 11. Notifications Requirement

Use Firebase Cloud Messaging.

App behavior:

- Register Android FCM token after login.
- Send token to backend.
- Receive:
  - Low SOC alert.
  - Charging opportunity.
  - Route/range nudge.
  - Driver coaching.
  - Emergency/operator messages.

Backend token endpoint already exists for web:

```text
POST /api/v1/auth/fcm-token
```

Mobile can reuse this endpoint with platform:

```json
{
  "token": "fcm_token",
  "platform": "android",
  "device_label": "driver-android"
}
```

If backend currently hardcodes platform as web in frontend only, API body already supports a platform field or should be extended.

---

## 12. Voice Destination Requirement

Use `ragusnotify.html` only as UX/prototype reference.

Do not copy its architecture directly.

Problems in the prototype:

- Gemini API key is directly embedded in frontend HTML.
- AI/geocoding is called directly from the client.
- Browser `SpeechRecognition` does not directly translate to React Native.
- Nominatim/Photon are prototype-grade fallbacks, not primary production geocoders for pilot.
- Some text has encoding artifacts.

Production mobile architecture:

```text
React Native voice input
  -> speech-to-text on device or backend
  -> backend destination resolver
  -> Google Places / Routes / optional LLM cleanup
  -> structured destination response
```

Recommended speech approach:

- MVP: `@react-native-voice/voice` for short destination phrases.
- Later: Google Speech-to-Text through backend if accuracy is not good enough for Indian place names.

Recommended geocoding:

- Primary: Google Places API / Places API (New).
- Secondary: Google Geocoding API where needed.
- Optional AI: LLM cleans speech text and extracts intent, but backend must verify with map APIs.

Security rule:

- Never put Gemini/OpenAI/Groq/Google server API keys inside the mobile app.
- All AI and privileged map calls must go through the backend.

---

## 13. Backend API Requirements

Recommended mobile endpoints:

```text
GET  /api/v1/mobile/me
POST /api/v1/mobile/location
POST /api/v1/mobile/trips/start
POST /api/v1/mobile/trips/end
POST /api/v1/mobile/voice/resolve-destination
POST /api/v1/mobile/charging/start
POST /api/v1/mobile/charging/end
POST /api/v1/mobile/waiting/start
POST /api/v1/mobile/waiting/end
POST /api/v1/mobile/issues
GET  /api/v1/mobile/alerts
POST /api/v1/mobile/alerts/{alert_id}/ack
```

Existing endpoints that can be reused:

```text
GET  /api/v1/auth/me
POST /api/v1/auth/fcm-token
GET  /api/v1/vehicles/me
GET  /api/v1/drivers/me
GET  /api/v1/alerts
POST /api/v1/telemetry/evify
POST /api/v1/telemetry/evify/bulk
GET  /api/v1/intelligence/live-map
GET  /api/v1/intelligence/drivers/{driver_id}/live-profile
GET  /api/v1/intelligence/drivers/{driver_id}/live-decision
```

Recommended backend addition:

```text
POST /api/v1/mobile/location
```

Reason:

- Mobile app GPS pings are not the same as Evify BMS telemetry.
- Keep rider phone GPS separate from vehicle telemetry.
- Backend can merge phone GPS with vehicle telemetry later.

Suggested request:

```json
{
  "lat": 21.1702,
  "lng": 72.8311,
  "accuracy_m": 18,
  "speed_mps": 5.2,
  "heading_deg": 135,
  "captured_at": "2026-05-28T10:00:00Z",
  "battery_pct": 78,
  "tracking_state": "trip_active"
}
```

Suggested backend behavior:

- Authenticate Supabase JWT.
- Resolve internal user and driver mapping.
- Store latest phone location in Redis.
- Persist sampled phone location in Postgres.
- Do not call external APIs on every GPS ping.
- Trigger expensive route/charger/weather lookups only on events.

---

## 14. Data Model Additions

Recommended new tables later:

### `mobile_location_points`

Purpose: phone GPS stream separate from vehicle telemetry.

Fields:

- `id`
- `user_id`
- `driver_id`
- `vehicle_id`
- `lat`
- `lng`
- `accuracy_m`
- `speed_mps`
- `heading_deg`
- `captured_at`
- `received_at`
- `tracking_state`
- `source = android_app`

### `mobile_trip_sessions`

Purpose: app-started trip context.

Fields:

- `id`
- `driver_id`
- `vehicle_id`
- `started_at`
- `ended_at`
- `origin_lat`
- `origin_lng`
- `destination_text`
- `destination_place_id`
- `destination_lat`
- `destination_lng`
- `status`
- `confidence`
- `source = action_button`

### `mobile_wait_events`

Fields:

- `id`
- `trip_session_id`
- `driver_id`
- `started_at`
- `ended_at`
- `lat`
- `lng`
- `wait_type`
- `confidence`

### `mobile_charging_sessions`

Fields:

- `id`
- `trip_session_id`
- `driver_id`
- `started_at`
- `ended_at`
- `lat`
- `lng`
- `charger_name`
- `charger_place_id`
- `soc_start`
- `soc_end`
- `confidence`

### `mobile_issue_events`

Fields:

- `id`
- `driver_id`
- `trip_session_id`
- `issue_type`
- `message`
- `lat`
- `lng`
- `created_at`
- `status`

---

## 15. Data Captured

### Trip Data

- Start time.
- End time.
- Origin.
- Destination text.
- Destination coordinates/place ID.
- GPS trace.
- Stops.
- Waiting time.
- Charging time.
- Battery/range context from backend.

### Voice Data

- Speech-to-text result.
- Extracted destination.
- Confidence score.
- Confirmation/correction history.

Do not store raw audio in MVP unless explicitly required.

### Charging Data

- Start/end time.
- GPS location.
- Nearby charger candidate.
- SOC if available.
- Duration.

### Waiting Data

- Start/end time.
- GPS location.
- Idle duration.
- Wait classification.

### Emergency Data

- Issue type.
- Time.
- Location.
- Trip context.
- Action taken.

---

## 16. AI And Intelligence Layer

The mobile app should not run core AI directly.

Backend-owned AI/intelligence:

- Destination cleanup.
- Place/entity extraction.
- Route feasibility.
- Charging recommendation.
- Battery/range insight.
- Nudge generation.
- Driver coaching.

Mobile-owned intelligence:

- Gesture recognition.
- Permission state.
- Offline queue state.
- Local UI state.
- Basic location sampling logic.

Backend must remain source of truth for facts, maps, profile, and recommendations.

---

## 17. Offline And Retry Requirements

The app should survive poor network.

MVP offline queue:

- Location pings.
- Trip start/end event.
- Waiting start/end event.
- Charging start/end event.
- Issue event.

Retry rules:

- Store event locally if network fails.
- Retry with exponential backoff.
- Include idempotency key per event.
- Backend should deduplicate by idempotency key.

---

## 18. Safety And Privacy Requirements

Must be clear to drivers:

- Tracking occurs during active ride/trip state.
- Background location requires visible foreground notification.
- Drivers can stop trip/tracking.
- Emergency sharing must be user initiated unless fleet policy says otherwise.

Security requirements:

- No API secrets inside mobile app.
- Supabase anon key is acceptable; service role keys are not.
- All backend calls require user token.
- Backend enforces role/driver mapping.
- Mobile GPS must not override vehicle telemetry without source labels.

---

## 19. React Native Technical Stack

Recommended:

- React Native CLI.
- TypeScript.
- React Navigation.
- Supabase JS for auth.
- Firebase Messaging for FCM.
- React Native Maps.
- `react-native-background-geolocation` if budget/legal allows, otherwise `react-native-geolocation-service` plus native Android foreground service setup.
- AsyncStorage or SQLite for offline queue.
- React Query for API state.
- Zustand or lightweight store for ride state.

Avoid for MVP:

- Expo managed workflow if background GPS/FCM native control becomes difficult.
- Heavy UI animation libraries unless needed.
- Building admin/fleet screens.

Dependency decision:

| Capability | Preferred | Lower-cost fallback | Notes |
|---|---|---|---|
| Background GPS | `react-native-background-geolocation` | `react-native-geolocation-service` + foreground service | Prefer robust library for pilot reliability if approved |
| Push | `@react-native-firebase/messaging` | none | FCM is required |
| Auth | `@supabase/supabase-js` | backend-issued token after Supabase login | Keep Supabase identity |
| Maps | `react-native-maps` | deep link to Google Maps | In-app map is better for rider workflow |
| Voice | `@react-native-voice/voice` | backend Google Speech-to-Text later | Start simple with short destination phrases |
| Offline queue | SQLite/MMKV | AsyncStorage | Queue must support retries/idempotency |

---

## 20. Suggested Folder Structure

```text
trickee-driver-mobile/
  android/
  ios/
  src/
    app/
      navigation/
      providers/
    features/
      trickee-driver/
        action-button/
        alerts/
        auth/
        charging/
        emergency/
        location/
        trip/
        waiting/
    services/
      trickeeApi/
      trickeeAuth/
      trickeeFcm/
      trickeeLocation/
      trickeeStorage/
    components/
      Button.tsx
      Card.tsx
      StatusBadge.tsx
    config/
      env.ts
    types/
```

Keep Trickee-specific logic modular so it can later be merged into the company's existing React Native app.

---

## 20.1 Scale-Up Architecture

The mobile app must be designed for pilot first, but not block scale.

### Phase 1: 10-20 Internal Testers

Goal: prove install, auth, GPS, FCM, and Action Button.

Architecture:

```text
React Native app
  -> Supabase Auth
  -> Trickee backend REST APIs
  -> Cloud SQL/Postgres
  -> Redis latest location/state
  -> Firebase FCM
```

Tracking:

- Conservative GPS interval.
- Small offline queue.
- Manual app distribution through Firebase App Distribution.

### Phase 2: 50-100 Vehicle Pilot

Goal: field reliability.

Required:

- Foreground location service for active rides.
- Offline queue with idempotency keys.
- Backend mobile location endpoint.
- Redis latest mobile driver state.
- Postgres sampled mobile location history.
- FCM test-push and production alert verification.
- Load testing for concurrent location pings.

Backend must not call Google/AI APIs per GPS ping.

Correct event model:

```text
GPS ping
  -> Redis latest state
  -> sampled Postgres persistence
  -> no external API call

Action event / state change / low SOC / long wait
  -> backend decision engine
  -> cached Maps/weather/charger lookup if needed
  -> alert/nudge
```

### Phase 3: 500-600 Vehicle Scale

Goal: move from direct REST ingestion to event pipeline.

Target architecture:

```text
React Native driver app / Evify telemetry
  -> Ingestion API
  -> Pub/Sub or MQTT broker
  -> Worker consumers
  -> Redis latest state
  -> Cloud SQL/Postgres or TimescaleDB history
  -> BigQuery analytics
  -> alert/nudge workers
  -> FCM delivery
```

Why this matters:

- Direct DB writes from app do not scale cleanly.
- Queue/broker protects ingestion from spikes.
- Workers isolate heavy processing from request latency.
- Redis serves live dashboard/mobile state.
- BigQuery handles analytics/reporting at larger volume.

Scale gate:

Move to Pub/Sub/MQTT/worker architecture when any of these happen:

- Location/telemetry rows exceed current backend capacity.
- Dashboard data becomes stale beyond acceptable SLA.
- API ingest latency consistently rises.
- Postgres write volume begins affecting read queries.
- Need replayable events/dead-letter queue.
- Pilot expands past 100 vehicles toward 500+.

### Phase 4: Company App Merge

After standalone pilot works:

```text
Company React Native app
  -> imports Trickee driver feature module
  -> uses company app shell/nav
  -> keeps Trickee backend APIs
  -> keeps FCM/location services or maps to company equivalents
```

Merge readiness checklist:

- Feature code isolated.
- API client isolated.
- Auth adapter isolated.
- Location service isolated.
- FCM service isolated.
- Offline queue isolated.
- No hardcoded pilot app package assumptions in business logic.
- Environment config separated.

---

## 21. MVP Build Order

1. Scaffold React Native CLI app.
2. Add Supabase login.
3. Add backend API client.
4. Add `/mobile/me` or reuse `/auth/me`.
5. Add notification permission and FCM token registration.
6. Add location permission flow.
7. Add foreground/background location service.
8. Add offline queue for location events.
9. Add Action Button home.
10. Add single tap trip start.
11. Add voice destination input.
12. Add backend destination resolver.
13. Add double tap charging event.
14. Add swipe waiting event.
15. Add long press emergency event.
16. Add alerts/nudges screen.
17. Add Firebase App Distribution build pipeline.
18. Test with internal riders.

---

## 22. Pilot Acceptance Criteria

The pilot app is acceptable when:

- Approved driver can log in.
- Pending user cannot access app.
- Driver can grant notification permission.
- Driver can grant foreground/background location permission.
- App registers FCM token with backend.
- App receives a test push.
- App starts a trip from Action Button.
- App captures current GPS.
- App sends location pings to backend.
- Redis/live map can show the latest mobile driver location or clearly label app GPS separately.
- App can mark waiting.
- App can mark charging.
- App can report issue.
- App queues events offline and retries.
- App can be distributed through Firebase App Distribution.

---

## 23. Success Metrics

Activation:

- Percentage of pilot drivers who install app.
- Percentage who complete login.
- Percentage who grant location and notification permissions.

Usage:

- Action Button uses per driver per day.
- Trips started through app.
- Charging sessions logged.
- Waiting events logged.
- Emergency/issue events logged.

Quality:

- Location ping success rate.
- Offline queue retry success rate.
- Voice destination success rate.
- Destination confirmation/correction rate.
- FCM delivery success rate.

Business:

- More complete trip context.
- More charging opportunities detected.
- Better wait-time intelligence.
- Better driver behavior/profile history.

North star metric:

```text
Successful mobility sessions started with one action.
```

---

## 24. Non-MVP / Later Features

- Full fleet dashboard.
- Quick Settings tile.
- Lock screen widget.
- Floating bubble overlay.
- Smartwatch trigger.
- Automatic charger reliability scoring.
- Driver rewards.
- Earnings prediction.
- Deep BMS integration inside app.
- Full order-platform integration.
- WhatsApp bot inside rider workflow.
- Native Kotlin rewrite unless React Native reliability is insufficient.

---

## 25. Open Questions

1. Will Evify/company provide access to the existing React Native app later?
2. Should Trickee create standalone `mobile_*` backend tables now or reuse current `trips`, `wait_events`, and telemetry tables for MVP?
3. Which background geolocation library is approved by budget/legal?
4. Does the pilot require Google login on mobile or only email/password?
5. Will drivers have stable email/phone/employee IDs for deterministic mapping?
6. Should app phone GPS be shown on fleet map alongside vehicle GPS, or only used as fallback/context?
7. What minimum GPS interval is acceptable for battery usage during pilot?

---

## 26. Final Recommendation

Build the mobile pilot as a standalone React Native CLI Android app, distributed with Firebase App Distribution.

Use the Action Button as the main rider interface. Keep the MVP narrow:

```text
login
permissions
background/foreground location
FCM alerts
start trip with voice destination
charging event
waiting event
emergency event
basic alerts/nudges
offline retry
```

Move all AI, Gemini, Google Maps, geocoding, and recommendation logic to the backend. The mobile app should capture intent and location; the backend should decide, verify, and recommend.
