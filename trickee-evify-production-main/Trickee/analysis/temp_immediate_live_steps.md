# Immediate Live-Stream First Steps

Date: 2026-05-04

## Core Direction

Use the Evify 28-04 dataset as the initial baseline for driver pattern understanding, not as a static report product.

The production feature should work from live telemetry:

- live driver profiles
- live location context
- live charging recommendations
- live wait/stop detection
- live route and external-condition personalization
- weekly reports generated from accumulated live data

## Immediate Product Steps

1. Build live driver profiles.
   - Regen ratio
   - Average speed
   - Low-SOC tendency
   - Charging behavior
   - Thermal load
   - Stop/wait pattern
   - Frequent operating zones from lat/lng

   Started in production code:
   - Added backend live driver profile computation.
   - Added `/api/v1/intelligence/drivers/{driver_id}/live-profile`.
   - Added driver-page live personalization card.
   - Added 28-04 baseline seed fields inside live profiles.
   - Added bad-data vehicle exclusion for `GJ05PZ1856`.
   - Added range-confidence and driver-specific warning SOC threshold.

2. Use 28-04 data as initial profile seed.
   - Exclude or flag bad-data vehicle `GJ05PZ1856`
   - Use D2/D3/D4/D5 patterns as baseline profiles
   - Update profiles continuously as new telemetry arrives

   Implemented in production code:
   - Added D2/D3/D4/D5 baseline profile seeds from the 28-04 analysis.
   - Live telemetry excludes `GJ05PZ1856`.
   - Live data overrides seed confidence as sample count and GPS coverage improve.

3. Add live personalization engine.
   - Personalized range confidence
   - Battery risk score
   - Charging nudge
   - Route recommendation
   - Driver-specific warning threshold

   Implemented in production code:
   - Added `/api/v1/intelligence/drivers/{driver_id}/live-decision`.
   - Added personalized range estimate using live SOC/SOH/thermal/power plus driver factor.
   - Added live charging recommendation, route recommendation, wait classification, and dashboard nudge output.

4. Add live maps.
   - Latest vehicle/driver location
   - Low-SOC zones
   - Frequent stop zones
   - Nearby chargers
   - Restaurant/order zones when available

   Implemented in production code:
   - Added `/api/v1/intelligence/live-map`.
   - Returns latest vehicle/driver points, low-SOC zones, frequent stop zones, and charger points.
   - Driver page and fleet page now show live map signal summaries.

5. Implement SOC-rise charging detection.
   - Do not depend only on `ChargePlugStatus`
   - Detect charging from SOC increase over time
   - Store detected charge events for driver profile and reports

   Started in production code:
   - Added SOC-rise charging detector.
   - Live telemetry ingest now records detected charging into `nudge_events`.
   - Driver live profile shows SOC-rise charging event count.

6. Add live wait/stop classification.
   - Traffic wait
   - Restaurant wait
   - Idle wait
   - Charging wait
   - Use speed, ignition, lat/lng, stop duration, and order context

   Implemented in production code:
   - Live ingest already stores wait events through the wait classifier.
   - Live decision endpoint returns the driver's current wait classification.
   - Fleet live view highlights stuck/waiting drivers.

7. Build live charging recommendation.
   - Charge now
   - Continue delivery
   - Detour to charger
   - Charge during restaurant wait
   - Use SOC, nearest charger, wait window, route, and driver profile

   Implemented in production code:
   - Live decision endpoint produces `charge_now`, `charge_during_wait`, `detour_to_charger`, `opportunistic_top_up`, or `continue_delivery`.
   - Uses SOC, driver risk profile, nearest charger, wait type, and optional order context.

8. Improve driver mobile view.
   - Current SOC/range
   - Personalized nudge
   - Nearest charger
   - Recommended action
   - Map

   Implemented in production code:
   - Driver page shows live recommended action, personalized range, nearest charger, wait state, operating zone, and map signal counts.

9. Improve fleet live view.
   - Active drivers
   - Battery-risk drivers
   - Inefficient drivers
   - Stuck/idle drivers
   - Charging opportunities

   Implemented in production code:
   - Added `/api/v1/intelligence/fleet/live`.
   - Fleet page shows active drivers, battery-risk drivers, inefficient drivers, waiting drivers, and charging opportunities.

10. Add weekly Evify report generation.
    - Use last 7 days of live accumulated data
    - Backend calculates metrics
    - Groq generates narrative summary only
    - Email/report output to Evify team

    Implemented in production code:
    - Added `/api/v1/intelligence/reports/weekly`.
    - Backend calculates 7-day live metrics from accumulated telemetry/waits/nudges.
    - Groq narrative generation is supported through `GROQ_API_KEY`; deterministic fallback is used when not configured.
    - LLM payload is sanitized to avoid sending names, email, phone, tokens, or secrets.
    - Email delivery is explicitly marked `not_configured` until an email provider is added.

## Production Security Work Added

- Fleet/operator history endpoints now scope results to the user's fleet.
- Charging decisions now verify driver/vehicle access before persisting.
- Demo database seeding is disabled by default.
- Demo seed passwords must come from env vars; hardcoded demo passwords were removed.
- Weekly Groq report sends sanitized operational metrics only.

## External Factors To Add

Production coverage added:
- Date/day/time/season context is included in the live driver profile.
- Weather context includes temperature, rain, humidity, wind, and heatwave severity where provider data exists, with safe fallbacks.
- Traffic context includes ETA delay, congestion index, incident placeholder, and stop-start probability.
- Route context supports distance, duration, traffic duration, elevation delta, grade, and destination scoring when a destination is provided.
- Location context includes latest lat/lng, operating zone, low-SOC zones, frequent stop zones, and nearby chargers.
- Order context is supported as optional input to the live decision endpoint.
- Vehicle context includes SOC, SOH, temperature, current, voltage, sag, cell imbalance, speed, ignition, and charge plug status.
- Driver context includes speed, regen, throttle, low-SOC tendency, charging habit, wait habit, personal factor, and baseline seed.
- Historical context currently uses 28-04 D2-D5 seed profiles plus rolling live telemetry windows.

1. Date context
   - Date
   - Month/season
   - Holiday flag
   - Festival/event flag

2. Day/time context
   - Weekday/weekend
   - Hour of day
   - Lunch peak
   - Dinner peak
   - Late-night shift
   - Driver usual active window

3. Weather context
   - Temperature
   - Rain
   - Humidity
   - Wind
   - Heatwave/severity score

4. Traffic context
   - Live congestion
   - ETA delay
   - Incident/closure
   - Stop-start probability

5. Route context
   - Distance
   - Expected duration
   - Elevation/slope
   - Road type
   - Stop density
   - Chargers along route

6. Location context
   - Current lat/lng
   - Depot distance
   - Restaurant/delivery zone
   - Nearest charger distance
   - Frequent stop zone
   - Low-SOC risk zone

7. Order context
   - Restaurant prep time
   - Handover buffer
   - Delivery distance
   - SLA/priority
   - Batch order flag

8. Vehicle context
   - SOC
   - SOH
   - Battery temperature
   - MCU/motor temperature
   - Current draw
   - Voltage sag
   - Cell imbalance
   - Predicted range

9. Driver context
   - Average speed
   - Regen ratio
   - Throttle behavior
   - Low-SOC tendency
   - Charging habit
   - Stop/wait habit
   - Personal energy factor

10. Historical pattern context
    - Same driver, same hour
    - Same route past consumption
    - Same weather past consumption
    - Same restaurant wait history
    - Same zone low-SOC history

## Outputs

The live decision engine should produce:

- personalized range prediction
- charging recommendation
- route recommendation
- driver nudge
- fleet alert
- weekly Evify report insight

Production output status:
- Personalized range prediction: implemented in live decision response and driver page.
- Charging recommendation: implemented in live decision response and driver/fleet views.
- Route recommendation: implemented in live decision response when destination is provided.
- Driver nudge: implemented as dashboard nudge output, with optional persistence.
- Fleet alert/risk: implemented in fleet live overview and scoped fleet risk lists.
- Weekly Evify report insight: implemented with live metrics plus Groq/deterministic narrative.

## Remaining Things To Implement Based On Production Code And Analysis Folder

Date added: 2026-05-04

These are the remaining production steps after the live intelligence foundation now present in `production/`. Items already completed are marked as completed so they are not treated as pending work.

1. Build the Evify live API connector.
   - Add env vars for Evify live API URL, auth token/header, poll interval, and batch size.
   - Create a backend service that pulls/polls the Evify API.
   - Convert every response through the existing Evify adapter and telemetry ingest pipeline.
   - Support both single-row and batch telemetry responses.
   - Store connector run status, last successful cursor/timestamp, and error reason.
   - Add idempotency/deduplication so repeated API rows do not create duplicate telemetry.

2. Finalize the live payload contract with Evify.
   - Confirm exact field names for vehicle id, driver id, timestamp, SOC, speed, current, voltage, temperature, SOH, ignition, charge plug, lat, and lng.
   - Confirm whether driver identity comes directly from Evify or needs mapping by vehicle/current assignment.
   - Confirm timezone and timestamp format.
   - Confirm update frequency and rate limits.
   - Confirm whether the live API returns only latest state or historical deltas.

3. Add production connector monitoring.
   - Add admin/fleet-visible connector health: last pull time, rows pulled, rows rejected, rows ingested.
   - Alert when live data is stale.
   - Alert when GPS coverage drops, SOC fields are missing, or a known vehicle stops sending data.
   - Add backend tests for connector success, auth failure, malformed payload, retry, and dedupe.

4. Completed: real visual map UI.
   - Added `/map` page in the Next.js dashboard.
   - Added reusable `LiveMapPanel` component.
   - Frontend map now uses Leaflet + OpenStreetMap.
   - Removed need for browser Google Maps key.
   - Live map renders vehicle/driver points, SOC/risk marker color, chargers, low-SOC zones, frequent stop zones, driver filter, refresh control, and sync status.
   - Sidebar and topbar now include Live Map navigation.
   - Server-side Google Places/Directions/Weather keys remain backend-only for intelligence.

5. Add real order and restaurant context.
   - Integrate order platform feed or manual order API.
   - Capture restaurant location, customer/drop location, prep time, SLA, priority, and batch-order flag.
   - Feed order context into live decision endpoint.
   - Improve restaurant wait vs traffic wait vs idle wait confidence.
   - Add order assignment UI showing why Trickee chose a driver.

6. Turn dashboard nudges into real driver notifications.
   - Persist live nudges by default only after dedupe rules are added.
   - Add FCM push path for high-confidence charging/range warnings.
   - Add acknowledgement/outcome tracking.
   - Measure whether the driver followed the nudge.
   - Feed outcomes into future V6 nudge optimization.

7. Add weekly report delivery.
   - Keep current weekly metrics and Groq narrative generation.
   - Add email provider integration, likely Resend or SendGrid.
   - Add recipient allowlist for Evify team emails.
   - Add scheduled job or external cron to generate/send weekly reports.
   - Store generated reports and delivery status.

8. Improve driver scorecards from live data.
   - Build fleet scorecard output using regen, speed, thermal load, low-SOC tendency, charging habit, wait habit, and personal energy factor.
   - Compare each driver against fleet baseline.
   - Add top improvers and battery-risk drivers.
   - Add scorecard history so weekly trend can be shown.

9. Train V5-A after live data accumulates.
   - Use live `driver_id` + telemetry windows to retrain with rolling driver behavior features.
   - Features: avg_current_30m, avg_speed_30m, regen_ratio_30m, throttle_var_30m.
   - Keep V4.1 as production inference until V5-A beats it on held-out live data.
   - Add evaluation report comparing V4.1 vs V5-A.

10. Build trip digital twins after enough history.
    - Reconstruct trips from live telemetry, ignition, speed, and GPS.
    - Calculate Wh/km per route segment and per driver.
    - Detect same-route, same-hour, same-weather behavior.
    - Use 60+ days of live data before treating these as reliable.

11. Add stronger geospatial clustering.
    - Replace simple rounded lat/lng buckets with DBSCAN or similar clustering.
    - Identify recurring restaurant zones, depot zones, charging zones, and low-SOC zones.
    - Track zone-level charging opportunity missed/used.
    - Use zone history in live charging recommendations.

12. Harden production security before pilot.
    - Keep all external API keys in Render/Vercel env vars only.
    - Add rate limiting for telemetry ingest and intelligence endpoints.
    - Add request logging without secrets or raw tokens.
    - Add payload size limits for telemetry and order APIs.
    - Add integration tests for fleet isolation, driver isolation, and unauthorized access.
    - Rotate any local/demo secrets before sharing pilot access.

13. Pilot readiness checklist.
    - Configure Render env vars for database, OpenWeather, Google Maps/Places, Groq, Firebase, and future Evify API.
    - Configure Vercel env vars for frontend backend URL, NextAuth, and Firebase public keys.
    - Run migration/check on production database.
    - Verify `/health`, auth login, fleet page, driver page, live profile, live decision, live map, report charts, and weekly report endpoints.
    - Run an end-to-end test using one real Evify live payload.

## Latest Implementation Update

Date added: 2026-05-04

1. Visual map UI is now implemented.
   - Frontend route: `/map`
   - Uses Leaflet + OpenStreetMap for the visual map.
   - Does not require `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`.
   - Uses existing backend live map endpoint: `/api/v1/intelligence/live-map`.
   - Displays:
     - live vehicle/driver GPS points
     - SOC/risk-colored markers
     - nearby charger points
     - low-SOC zones
     - frequent stop zones
     - driver filter
     - refresh button
     - backend/frontend sync status

2. Backend ETA personalization was tightened.
   - Existing `/routes/score` already used `driver.personal_factor`.
   - Live decision route recommendations now also return:
     - `traffic_duration_min`
     - `personalized_eta_min`
     - `personal_factor`
   - ETA logic:
     - `personalized_eta = traffic_eta * driver.personal_factor`

3. Visual report charts from shared folders were added.
   - Source folder: `Trickee/pitch-evifyxabzo/charts`
   - Frontend asset folder: `production/trickee-frontend/public/report-charts`
   - Frontend route: `/reports`
   - Added Evify and ABZO report tabs.
   - Added 10 chart visuals:
     - Evify range accuracy
     - Evify harsh events
     - Evify speed vs energy
     - Evify SOC trajectory
     - Evify charger proximity
     - ABZO range accuracy
     - ABZO harsh events
     - ABZO speed vs energy
     - ABZO SOC trajectory
     - ABZO charger proximity
   - Sidebar and topbar now include Report Charts navigation.

4. Shared folder review notes.
   - `Trickee/evify_streamlit_deploy` contains the old Streamlit V4.1 predictive dashboards, model/scaler assets, and CSV training data.
   - `Trickee/pitch-evifyxabzo` contains pitch-ready report markdown, chart generator, and static chart PNGs.
   - The chart PNGs have been integrated into the Next.js product.
   - Streamlit predictive dashboard logic remains useful as visual/reference material for future V4.1 panels, but the production app already uses the FastAPI/Next.js implementation.

5. Verification after latest implementation.
   - Frontend TypeScript passed.
   - Frontend lint passed with only older unrelated warnings.
   - Backend tests passed: 20 tests.
   - `/map` responded with 200.
   - `/reports` responded with 200.

6. Security/dependency note.
   - Leaflet/OpenStreetMap did not introduce the existing audit warnings.
   - `npm audit --omit=dev` still flags existing `next` and `next-auth` advisories.
   - Fixing those requires a planned Next/Auth upgrade, not an automatic forced update.

## Features That Become Stronger After Enough Live Data

These features are technically supported by the current production foundation, but they become reliable only after enough live telemetry is gathered. The main key for personalization is `driver_id`. If Evify cannot send `driver_id` directly, we need a reliable vehicle-to-driver shift assignment mapping.

### Data Storage Pattern

Live data is stored in the database like this:

- `telemetry`
  - Primary live stream table.
  - Stores `vehicle_id`, `driver_id`, `recorded_at`, SOC, speed, current, voltage, temperature, SOH, ignition, charge plug, lat/lng, regen, throttle, and derived battery fields.

- `driver_behavior_snapshots`
  - Stores rolling driver features by `driver_id`.
  - Used for driver behavior profile and later model training.

- `wait_events`
  - Stores restaurant/traffic/idle/charging wait history by `driver_id` and `vehicle_id`.

- `nudge_events`
  - Stores charging alerts, live personalization nudges, SOC-rise charging detection, and future nudge outcomes.

- `trips`
  - Stores inferred/completed trip history by `driver_id` and `vehicle_id`.

- `predictions`
  - Stores model prediction results and can attach predictions to `driver_id`.

- `charging_decision_records`
  - Stores charging recommendations by driver, vehicle, and order.

- `order_assignment_decisions`
  - Stores which driver was chosen for an order and why.

### Maturity Windows

1. Immediate: first live rows to 1 day
   - Current SOC/range
   - Latest vehicle location
   - Low-SOC alerts
   - Nearest charger suggestions
   - Basic stop/wait detection
   - SOC-rise charging detection
   - Basic live driver profile with 28-04 baseline seed

2. Short window: 3 to 7 days
   - Driver average speed pattern
   - Regen ratio pattern
   - Stop/wait habit
   - Charging frequency
   - Low-SOC tendency
   - Battery-risk trend
   - Weekly Evify report from live data

3. Medium window: 14 to 30 days
   - Same-driver same-hour behavior
   - Frequent operating zones
   - Frequent stop zones
   - Low-SOC risk zones
   - Charging habit by time of day
   - Better driver scorecards
   - More confident route and charging recommendations

4. Strong window: 60+ days
   - Trip digital twin reconstruction
   - Same route past consumption
   - Same weather past consumption
   - Same restaurant wait history
   - Same zone low-SOC history
   - Driver-vs-fleet comparison trends
   - Reliable Wh/km per driver and per route segment
   - Better personalized ETA/range calibration

5. Longitudinal ML window: 90+ days
   - V5-A retraining using live driver behavioral features
   - Driver embedding experiments
   - Nudge effectiveness learning
   - Early V6 driver twin foundation
   - Stronger prediction evaluation against V4.1

### Features That Depend Most On `driver_id`

- Personalized range prediction
- Personalized ETA
- Driver scorecards
- Driver charging habits
- Driver low-SOC tendency
- Driver wait/stop behavior
- Same-driver same-hour patterns
- V5-A model training
- V6 driver twin / embeddings
- Nudge outcome learning

If `driver_id` is missing or unreliable, the system can still work at vehicle level using `vehicle_id`, but personalization will be weaker and driver-specific learning will be delayed.

## Scalable Live Architecture And Continuous Map Updates

The current production system is ready for REST/API-based telemetry ingestion. For pilot scale, Evify can provide a live API URL and Trickee can poll or pull rows into the existing ingest pipeline. For larger fleet scale, the analysis folder describes a more streaming-native architecture using MQTT/Kafka-style ingestion.

### Current Production Architecture

Current flow:

```text
Evify live API / telemetry payload
   -> FastAPI telemetry ingest
   -> Evify adapter normalization
   -> PostgreSQL telemetry storage
   -> live profile / wait / charging / map / report services
   -> Next.js dashboard
```

This is enough for pilot usage and API handshakes.

### Scalable Architecture For Larger Fleets

Target scalable flow:

```text
vehicle / IoT device / Evify feed
   -> MQTT topic or live API connector
   -> ingestion worker
   -> Kafka / Redpanda event stream
   -> stream processors
   -> PostgreSQL for relational history
   -> TimescaleDB or partitioned telemetry tables for high-volume time-series
   -> Redis for latest driver/vehicle state
   -> WebSocket/SSE channel for live frontend updates
   -> Next.js map, fleet, driver, alerts
```

Recommended components:

- MQTT
  - Useful when vehicles/devices publish directly.
  - Topic examples:
    - `evify/fleet/{fleet_id}/vehicle/{vehicle_id}/telemetry`
    - `evify/fleet/{fleet_id}/driver/{driver_id}/location`

- Kafka or Redpanda
  - Useful when many vehicles produce high-frequency telemetry.
  - Lets us replay data, build stream processors, and keep ingestion decoupled from dashboards.

- Stream processors
  - Consume telemetry events.
  - Update live state, wait detection, SOC-rise charging detection, low-SOC alerts, driver behavior windows, and map points.

- PostgreSQL
  - Stores users, fleets, vehicles, drivers, trips, alerts, nudges, reports, and decision records.

- TimescaleDB or partitioned telemetry tables
  - Better for high-volume telemetry history.
  - Helps with 60-day/90-day driver twin and V5/V6 training queries.

- Redis
  - Stores latest state per `driver_id` / `vehicle_id`.
  - Useful for fast live map rendering and active-driver counters.

- WebSocket or Server-Sent Events
  - Pushes driver movement to the frontend without waiting for full page polling.
  - Required for Zomato/Swiggy-like live map experience.

### Continuous Driver Movement On Map

The current `/map` page refreshes live map data from the backend. For a Zomato/Swiggy-style experience, the next production step is continuous updates:

```text
incoming telemetry row
   -> update latest driver location
   -> publish live location event
   -> frontend receives event over WebSocket/SSE
   -> marker moves smoothly on the map
```

Expected live map behavior:

- Driver marker moves continuously as new lat/lng arrives.
- Marker color changes by battery risk:
  - green/teal: normal
  - amber: medium risk
  - red: high risk or low SOC
- Marker popup shows driver, vehicle, SOC, ETA, speed, wait state, and recommended action.
- Low-SOC zones and frequent stop zones update as more data accumulates.
- Charger markers stay visible and recommendations update when the driver moves.
- Fleet operator can filter by:
  - active drivers
  - low-SOC drivers
  - charging opportunities
  - stuck/waiting drivers
  - inefficient drivers
  - selected driver/vehicle

### Suggested Update Frequency

- Driver map marker updates:
  - every 5 to 10 seconds if live telemetry supports it
  - every 15 to 30 seconds if API polling is the only available option

- Risk and recommendation updates:
  - every telemetry row
  - or every 30 seconds for dashboard efficiency

- Weekly/report metrics:
  - batch calculation every day or weekly

### What To Add Next For Continuous Map

1. Add latest-state cache.
   - Key by `driver_id` and `vehicle_id`.
   - Store latest lat/lng, SOC, speed, ETA, risk, wait state, and nudge.

2. Add WebSocket or SSE endpoint.
   - Example: `/api/v1/stream/fleet/live`
   - Emits driver/vehicle location updates and risk changes.

3. Add frontend marker animation.
   - Keep existing Leaflet/OpenStreetMap visual map.
   - Move markers smoothly instead of full refresh.
   - Keep fallback polling if WebSocket/SSE disconnects.

4. Add stream dedupe and ordering.
   - Ignore stale telemetry timestamps.
   - Deduplicate repeated vehicle records.
   - Handle out-of-order API batches.

5. Add stale-driver detection.
   - Mark driver stale if no telemetry in last configured window.
   - Show stale marker state on map.

6. Add production scale storage.
   - Keep PostgreSQL for pilot.
   - Move high-frequency telemetry to TimescaleDB/partitioned tables when volume grows.
   - Add Kafka/Redpanda when multiple sources or high event volume appear.

### Practical Pilot Recommendation

Start with:

```text
Evify live API polling
   -> FastAPI ingest
   -> PostgreSQL
   -> `/api/v1/intelligence/live-map`
   -> Leaflet map refresh every 15-30 seconds
```

Then upgrade to:

```text
Evify/MQTT stream
   -> Kafka/Redpanda
   -> Redis latest-state cache
   -> WebSocket/SSE
   -> smooth moving Leaflet markers
```

This keeps the pilot simple while preserving a clear path to fleet-scale live tracking.
