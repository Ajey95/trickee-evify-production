# Google Maps APIs For Trickee
**Created:** 2026-05-21
**Purpose:** Source-of-truth for which Google Maps Platform APIs Trickee should enable for pilot, what each one is used for, and which APIs should stay disabled until the roadmap actually needs them.

---

## 1. Pilot Decision

For the 50-100 vehicle pilot, enable only:

1. **Directions API**
2. **Maps Elevation API**
3. **Places API (New)**

These match the current backend code paths in `production/backend/app/services/external_context.py`.

Do not enable extra APIs just because they are available. Enabling an API does not charge by itself, but it increases blast radius if a key leaks or a loop starts calling an unused expensive service.

---

## 2. Required APIs

| API | Enable For Pilot | Trickee Use Case | Current Code Path | Cost Risk |
|---|---:|---|---|---|
| **Directions API** | Yes | ETA, traffic-aware duration, wait-time model, charging detour checks, personal ETA factor update | `external_context.directions()` calls `maps.googleapis.com/maps/api/directions/json` | Medium/high if called in a loop |
| **Maps Elevation API** | Yes | Elevation delta / slope context for range and battery-drain reasoning | `external_context.elevation_delta()` calls `maps.googleapis.com/maps/api/elevation/json` | Low/medium; cache heavily |
| **Places API (New)** | Yes | Nearby EV charger discovery around driver, restaurant, stop, or charging recommendation location | `external_context.nearest_chargers()` calls `places.googleapis.com/v1/places:searchNearby` with `electric_vehicle_charging_station` | Medium/high if charger lookup is called per telemetry row |

Implementation note:

- Backend now prefers Places API (New).
- It keeps legacy nearby search as a fallback only.
- If GCP shows `REQUEST_DENIED` for the old `nearbysearch/json` endpoint, that is acceptable as long as `google_places_new` results are returned.

Required env vars:

```env
GOOGLE_MAPS_API_KEY=<backend directions/elevation key>
GOOGLE_PLACES_API_KEY=<backend places key>
```

Best practice:

- Use separate backend keys.
- Restrict each key to only the APIs it needs.
- Store keys only in Render backend environment variables.
- Do not expose backend keys through `NEXT_PUBLIC_*`.

---

## 3. Optional Later APIs

| API | Enable Now? | When Trickee Needs It |
|---|---:|---|
| **Geocoding API** | No | If Evify/order platform gives restaurant/customer addresses instead of lat/lng. |
| **Roads API** | No | If trip history needs snap-to-road cleanup for noisy GPS breadcrumbs. Use sampled trip traces, not every telemetry row. |
| **Routes API** | No | Future replacement for Directions API when we migrate to the newer routing stack. |
| **Distance Matrix API** | No | If we need many-to-many ETA checks, such as many drivers to many restaurants/chargers. |
| **Maps JavaScript API** | No | Only if the frontend moves from Leaflet/OpenStreetMap to Google Maps UI. |
| **Navigation SDK** | No | Later native Android/iOS driver app upgrade for embedded turn-by-turn navigation. Not useful for the current Next.js web dashboard. |
| **Weather API** | No | Only if replacing OpenWeatherMap with Google Weather. Current backend uses OpenWeatherMap. |

---

## 4. APIs To Keep Disabled For Pilot

| API | Decision | Reason |
|---|---|---|
| **Places Aggregate API** | Disable | Not needed for current charger lookup, route scoring, H3 clustering, or stop/wait detection. |
| **Route Optimization API** | Disable | Not needed unless Trickee becomes a full multi-vehicle shipment optimizer with many drivers, many orders, time windows, and constraints. |
| **Places UI Kit** | Disable | Frontend is not using Google Places UI components. |
| **Geolocation API** | Disable | Vehicles already provide GPS. Browser/mobile GPS uses the browser geolocation API, not Google Geolocation API. |
| **Navigation SDK** | Disable for pilot | Enable later only for a native Android/iOS driver app with in-app turn-by-turn navigation. |
| **Map Tiles API** | Disable | Frontend currently uses Leaflet/OpenStreetMap, not Google map tiles. |
| **Maps Static API** | Disable | No static Google map image generation is required. |
| **Maps Embed API** | Disable | No Google embedded iframe map is required. |
| **Street View APIs** | Disable | Not relevant for EV fleet intelligence. |
| **Aerial View API** | Disable | Not relevant for pilot. |
| **Air Quality API** | Disable | Not used in current battery/routing model. |
| **Solar API** | Disable | Not relevant. |
| **Pollen API** | Disable | Not relevant. |
| **Map Management API** | Disable | Not styling Google Maps assets. |
| **Maps Datasets API** | Disable | Not uploading custom geospatial datasets to Google Maps for pilot. |

---

## 5. H3 Clustering vs Places Aggregate API

H3 clustering does **not** require Places Aggregate API.

Trickee H3 usage is local and backend-owned:

```text
vehicle GPS / stop points / low-SOC events
  -> convert lat/lng to H3 cell
  -> count events per cell
  -> identify dense stop zones, low-SOC zones, charger-demand zones
  -> cache weather/elevation/traffic/charger lookups by H3 cell
```

This uses:

- our telemetry rows
- our stop/wait events
- our low-SOC events
- our charger lookup results
- local H3 library
- Postgres/Redis/in-memory cache

It does **not** need Google to tell us aggregate place density.

### When Places Aggregate API Would Be Useful

Only consider Places Aggregate API later if we need Google-owned place-density analytics such as:

- "How many restaurants exist inside each H3 cell?"
- "Which grid cells have the highest commercial-place density?"
- "Where are food pickup hotspots before we have our own stop history?"
- "Which areas have high POI density but poor charger coverage?"

Even then, it should be an offline/planning job, not a live telemetry path.

For pilot, dense-area detection should come from Trickee telemetry:

```text
frequent stops + ignition off/on + speed < 3 km/h + dwell time + H3 cell counts
```

This is cheaper, more relevant, and safer than calling Place Aggregate.

---

## 6. Quota And Billing Guardrails

Set daily quotas before pilot.

Suggested pilot caps:

| API | Suggested Daily Cap |
|---|---:|
| Directions API | 500/day |
| Maps Elevation API | 500/day |
| Places API (New) | 500/day |
| Geocoding API | 0 or disabled |
| Roads API | 0 or disabled |
| Routes API | 0 or disabled |
| Distance Matrix API | 0 or disabled |
| Navigation SDK | disabled until native-app phase |

Current backend already reduces API burn through:

- H3/grid cache keys
- in-memory TTL caches
- optional Redis persistent cache
- provider daily quota guards
- fallback responses when keys/quota are missing
- event-triggered external calls instead of per-row external calls

Forbidden pattern:

```text
every telemetry row -> Google API call
```

Allowed pattern:

```text
event/route/stop context -> cached Google API call -> fallback if unavailable
```

---

## 7. Final Pilot Setup

Recommended enabled APIs:

```text
Directions API
Maps Elevation API
Places API (New)
```

Recommended disabled APIs:

```text
Place Aggregate API
Route Optimization API
Roads API
Routes API
Distance Matrix API
Maps JavaScript API
Geocoding API
Geolocation API
Navigation SDK
all non-routing/non-place environment APIs
```

If an API key was pasted into chat, GitHub, or any public/shared place, rotate it immediately and deploy the new restricted key.

---

## 8. Later Upgrade: Navigation SDK

### Decision

Navigation SDK is a **later native driver-app upgrade**, not a pilot web-dashboard dependency.

Use it only if Trickee builds a native Android/iOS driver app and wants turn-by-turn navigation inside the Trickee app instead of opening Google Maps externally.

### What It Enables

Navigation SDK can provide:

- embedded Google Maps turn-by-turn navigation
- driver navigation viewport
- route guidance UI
- custom markers
- some header/footer/viewport customization
- native Android/iOS navigation experience

### What It Does Not Replace

Navigation SDK does not replace the backend route intelligence layer.

Trickee still needs:

- backend route scoring
- SOC/range feasibility checks
- charger recommendation logic
- wait-time and stop-window intelligence
- nudge/alert decision logic
- audit logs and recommendation history

The backend decides **where the driver should go**. Navigation SDK only helps guide the driver there inside a native app.

### Current Pilot Alternative

For web/PWA pilot, use Google Maps deep links:

```text
https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>
```

Use cases:

- "Navigate to charger"
- "Navigate to restaurant"
- "Navigate to recommended stop"

This is cheaper, simpler, and works immediately from Chrome/mobile browser.

### When To Enable Navigation SDK

Enable Navigation SDK only when all are true:

1. Trickee has a native Android or iOS driver app.
2. Drivers need in-app turn-by-turn navigation instead of Google Maps handoff.
3. Product wants a branded navigation experience.
4. Billing terms and quotas are reviewed in Google Cloud.
5. Mobile key restrictions are configured.
6. Pilot route/charging logic is already validated.

### Native App Key Restrictions

Use separate mobile keys:

```text
Android key:
  restrict by Android package name + SHA-1 certificate
  allow only Navigation SDK and required Maps SDK APIs

iOS key:
  restrict by iOS bundle identifier
  allow only Navigation SDK and required Maps SDK APIs
```

Do not reuse backend server keys inside native apps.

### Billing Guardrail

Navigation SDK pricing depends on Google Maps Platform terms/service agreement. Before enabling it for production:

- check current GCP billing terms
- set budget alerts
- set quotas where available
- test with small internal users first
- monitor per-driver navigation sessions

### Roadmap Placement

Recommended roadmap status:

```text
Navigation SDK:
  status = future_native_app_upgrade
  pilot_web_status = not_required
  current_web_action = open_google_maps_deep_link
```
