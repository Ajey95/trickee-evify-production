# Mobile UI Endpoint Coverage Plan

Updated: 2026-06-24

## Implemented Android OS Quick Access

The mobile app now has Android system-surface entry points for the core driver actions.

Implemented:

- Persistent Android notification actions:
  - SOS
  - Copilot
  - Trip
  - Charging
- Android Quick Settings tile:
  - Label: `Trickee`
  - Tap action: Copilot
- Native-to-JS bridge:
  - stores pending action when the native side receives it
  - emits `quickAction` to the React Native runtime when active
- Android 13+ notification permission handling before showing the persistent quick-action notification.
- Backend action mapping:
  - SOS -> issue report
  - Trip -> start/end trip
  - Charging -> start/end charging
  - Copilot -> assistant message using current mobility context

Remaining for full no-open-app behavior:

- Verify on Android device/emulator after JDK setup.
- Add Headless JS or native foreground-service execution for cold-start actions.
- Add voice capture and destination-resolution system entry points.

## Implemented Quick Access Entry Points

The Home screen now has a compact top quick-access strip below the active order panel.

Buttons:

- Route
  - Opens `RouteIntelScreen`.
  - Entry point for charger recommendations and future route score/reroute/explain UI.
- Battery
  - Opens `MonitoringScreen`.
  - Entry point for telemetry diagnostics and future battery insight/prediction UI.
- Copilot
  - Opens `AIAssistantScreen`.
  - Entry point for assistant, coaching, and future voice/copilot UI.
- Trips
  - Opens `PastTripsScreen`.
  - Entry point for trip history and future trip trace UI.
- Profile
  - Opens the More/Profile area.
  - Entry point for profile, notifications, and account settings.
- SOS
  - Opens the existing Driver Action Sheet.
  - Entry point for report issue / emergency actions.

## Implemented With No Or Minimal UI Change

- `GET /api/v1/auth/ws-ticket`
  - Mobile now uses this to open `/ws/live-map`.
  - Incoming live-map points update existing live telemetry state.
  - No visible UI redesign required; existing Home, Monitoring, and Live Map consumers receive fresher state through `LiveDataContext`.

- `/ws/live-map`
  - Mobile now connects when `Features.liveWebSocket` is enabled.
  - Polling remains the fallback.

- `GET /api/v1/auth/signup-options`
  - Mobile signup now silently preloads vehicle options.
  - Existing vehicle plate/code input is resolved to backend vehicle UUID before submitting access request when possible.
  - No new dropdown or screen added.

- `DELETE /api/v1/auth/fcm-token`
  - API client support exists through `api.unregisterFcmToken`.
  - Runtime token generation/storage is still blocked until Firebase client config is added.

## Remaining UI Work

### Notifications / FCM

Endpoints:

- `POST /api/v1/auth/fcm-token`
- `DELETE /api/v1/auth/fcm-token`

Required UI/native work:

- Add Firebase Android config:
  - `google-services.json`
  - Gradle Google Services plugin
  - `@react-native-firebase/app`
  - `@react-native-firebase/messaging`
- Add Android notification permission flow.
- Optional More screen toggle/status:
  - notifications enabled
  - last token registration status

### Voice Destination And Copilot

Endpoints:

- `POST /api/v1/mobile/voice/resolve-destination`
- `POST /api/v1/mobile/voice/copilot`

Required UI work:

- Add a microphone button or text transcript action.
- Add voice permission handling.
- Add destination confirmation before starting a trip.
- Reuse existing AI Assistant screen for copilot responses where possible.

Recommended placement:

- Driver Action Sheet for destination resolution.
- AI Assistant screen for copilot.

### Route Intelligence Actions

Endpoints:

- `POST /api/v1/routes/score`
- `POST /api/v1/routes/reroute`
- `POST /api/v1/routes/explain`

Required UI work:

- Add route score card to Route Intelligence.
- Add reroute action button.
- Add route explanation panel.
- Optionally show route safety/efficiency reason text in Live Map.

Recommended placement:

- `RouteIntelScreen`
- Optional Live Map route summary.

### Battery And Predictions

Endpoints:

- `POST /api/v1/battery/insight`
- `POST /api/v1/predictions/infer/{vehicle_id}`
- `GET /api/v1/predictions/{vehicle_id}/history`

Required UI work:

- Add battery insight card.
- Add predicted SOC/range status.
- Add compact prediction history chart or list.

Recommended placement:

- Monitoring screen.
- Home battery panel for a short summary.

### Trip Trace

Endpoint:

- `GET /api/v1/drivers/{driver_id}/trips/{trip_id}/trace`

Required UI work:

- Add Past Trip detail view or modal.
- Show route trace on map.
- Show trip telemetry timeline summary.

Recommended placement:

- Past Trips screen.

### Driver Profile And Coaching

Endpoints:

- `POST /api/v1/drivers/{driver_id}/profile/update`
- `POST /api/v1/drivers/{driver_id}/coaching`

Required UI work:

- Add editable profile fields or operator-approved profile update flow.
- Add coaching card/list view.
- Decide whether coaching is shown as static cards or chat-like advice.

Recommended placement:

- More/Profile screen.
- AI Assistant screen for coaching conversations.

### Firebase Login

Endpoint:

- `POST /api/v1/auth/firebase-login`

Required UI/native work:

- Add Firebase Auth client config.
- Replace placeholder Google/Apple buttons with real provider flows.
- Decide pilot auth mode:
  - keep legacy email/password for pilot
  - or switch mobile to Firebase login

## Not Recommended For Driver Mobile UI

These backend routes should remain dashboard/admin/ops surfaces unless product scope changes:

- `/api/v1/admin/*`
- `/api/v1/fleet/*`
- `/api/v1/telemetry/evify`
- `/api/v1/telemetry/evify/bulk`
- most `/api/v1/intelligence/history/*`
- `/api/v1/vehicles/*` fleet-management views
- `/api/v1/alerts/test-push`
- `/api/v1/notifications/personalize`

## Recommended Implementation Order

1. Verify live WebSocket and background GPS on Android device.
2. Add route score/explain/reroute cards in Route Intelligence.
3. Add battery insight and prediction history in Monitoring.
4. Add trip trace detail in Past Trips.
5. Add voice destination/copilot.
6. Add Firebase/FCM once Firebase Android config is ready.
