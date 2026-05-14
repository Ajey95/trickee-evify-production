# Trickee Implementation Status And Remaining Work

**Date:** 2026-05-13  
**Scope:** Current FastAPI backend, Next.js frontend, Evify telemetry ingestion, live GPS/WebSocket flow, driver personalization, destination charge planning, dashboard presentation layer, recommender foundations, ML/intelligence services, deployment readiness, and remaining pilot gaps.

**Maintenance rule:** Whenever production code under `production/` changes, this file must be updated in the same work session so implementation status stays aligned with the actual codebase.

---

## 1. Current Architecture

Trickee is now a backend-connected EV intelligence platform with live telemetry support.

- **Frontend:** Next.js 14 App Router in `production/trickee-frontend`
- **Backend:** FastAPI in `production/backend`
- **Database:** SQLAlchemy relational schema, configured for Supabase/Postgres through `DATABASE_URL`
- **Auth:** Firebase login maps to backend users; backend JWT is stored in NextAuth session
- **Live map:** OpenStreetMap/Leaflet with WebSocket updates and REST fallback
- **Telemetry:** Evify payload ingestion plus historical/backfill utilities
- **ML:** V4.1 SOC/range inference with V5/V6 learning foundations
- **Personalization:** Dynamic driver archetypes derived from live driver profile metrics
- **Destination charging:** Route/live decisions can tell a driver exactly how much SOC is needed, how many minutes to charge, and which charger to use before committing to a destination.
- **Notifications:** FCM foundations plus optional Resend weekly report email
- **Deploy targets:** Vercel frontend and Render backend

Current live-state principle:

```text
Fresh incoming GPS -> WebSocket vehicle_point -> frontend map
DB latest row      -> reload/reconnect/fallback/history/analytics
```

So fresh telemetry GPS no longer needs to be re-fetched from DB before moving the map. The DB remains the durable source for reporting, history, trips, zones, analytics, and fallback state.

---

## 2. Backend Implemented

### 2.1 Core API

Implemented:

- FastAPI app with REST API under `/api/v1`
- Health endpoint at `/health`
- CORS configuration including production Vercel origin
- SQLAlchemy ORM models
- Alembic migrations
- Dockerfile and Render blueprint
- Environment templates
- Role-based backend guards

Mounted routers:

- `auth`
- `vehicles`
- `drivers`
- `intelligence`
- `telemetry`
- `predictions`
- `routes`
- `alerts`
- `admin`
- `ws`

### 2.2 Database Schema

Implemented tables/foundations:

- `fleets`
- `users`
- `vehicles`
- `drivers`
- `telemetry`
- `predictions`
- `alerts`
- `trips`
- `device_push_tokens`
- `driver_behavior_snapshots`
- `nudge_events`
- `order_assignment_decisions`
- `charging_decision_records`
- `wait_events`

Telemetry rows store `lat` and `lng`. These coordinates are used for DB-backed latest-location fallback, trip inference, wait classification, charger context, low-SOC zones, and historical analysis.

### 2.3 Evify Telemetry Ingestion

Implemented:

- Evify payload normalization
- Single ingest endpoint: `POST /api/v1/telemetry/evify`
- Bulk ingest endpoint: `POST /api/v1/telemetry/evify/bulk`
- Vehicle and driver creation from payload identity
- Duplicate protection by `vehicle_id + recorded_at`
- Derived physics fields
- Trip inference
- Wait event update
- Charging alert creation
- SOC-rise charging detection
- Direct live GPS WebSocket broadcast after successful DB commit

Current live GPS flow:

```text
Evify payload
  -> normalize
  -> persist Telemetry row
  -> build vehicle_point from fresh row
  -> scope by role/fleet/driver
  -> WebSocket broadcast
  -> frontend patches map marker
```

### 2.4 Live Map And WebSockets

Implemented:

- WebSocket endpoint:
  - `/ws/live-map?token=<jwt>`
  - `/ws/live-map?token=<jwt>&driver_id=<driver-id>`
- DB-backed `live_map` snapshots
- Direct `vehicle_point` updates from telemetry ingest
- In-memory connection manager
- Connection scope filters:
  - admin can see all
  - fleet operator sees own fleet
  - driver sees own driver ID
  - selected-driver filter narrows updates
- REST fallback via `GET /api/v1/intelligence/live-map`

Message types:

```json
{ "type": "live_map", "data": { "vehicle_points": [], "charger_points": [] } }
```

```json
{ "type": "vehicle_point", "data": { "driver_id": "...", "vehicle_id": "...", "lat": 21.17, "lng": 72.83 } }
```

Known scale limitation:

- WebSocket connections are currently in-memory. This is fine for a single Render process, but multi-worker deployment needs Redis pub/sub or another shared event bus.

### 2.5 V4.1 Prediction

Implemented:

- V4.1 model loading from `models_ml`
- PyTorch/joblib artifact support
- 20-step feature window
- No `delta_soc` input leakage
- Dynamic range physics adjustment
- Prediction persistence
- Prediction history endpoint

V4.1 remains the production serving model.

### 2.6 Intelligence And Recommender Foundations

Implemented:

- Live driver profile
- Fleet live overview
- Live map context
- Weekly live metrics
- Driver behavior metrics
- Wait classifier and wait estimator
- Order assignment engine
- Charging decision engine
- Route scorer and reroute
- Destination charge planner in `charge_plan.py`
- Nudge/event persistence
- Intelligence history endpoints

These are currently deterministic/rule-scoring recommenders, not trained collaborative-filtering or reinforcement-learning recommenders.

Destination charge planning now produces messages in this shape:

```text
Destination needs 18.0% SOC. You have 22.0%. Charge for 9 min at Charger X to reach with 10% buffer.
```

Implementation details:

- `route_scorer.py` attaches `destination_charge_plan`, `charge_minutes_required`, and `top_up_soc_required_pct` to scored routes.
- `live_intelligence.py` uses personalized range to estimate destination SOC requirement and converts `charge_first` nudges into exact top-up guidance.
- If a route is infeasible or too tight, the nudge is no longer generic; it names the needed SOC, current SOC, charge minutes, charger, and buffer.
- The planner defaults to a 10% arrival buffer and a conservative charging-rate estimate, with charger metadata passed through when available.

### 2.7 Driver Archetype Personalization

Implemented now:

- Dynamic driver archetype classifier in `live_driver_profile.py`
- Archetype returned from `live_driver_profile()`
- Archetype included in fleet live overview rows
- Archetype included in live driver decision payloads
- Archetype included in persisted live personalization nudge payloads
- Archetype label included in live map vehicle points
- Archetype-aware charging thresholds
- Archetype-aware route range buffers
- Archetype-aware order assignment scoring when caller includes driver archetype

Current archetypes:

- `range_saver`
- `aggressive_drainer`
- `late_charger`
- `stop_wait_optimizer`
- `heat_stress_rider`
- `route_sensitive`
- `moderate`
- `data_poor`

Classifier inputs already computed by `live_driver_profile()`:

- `sample_count`
- `avg_current_a`
- `regen_ratio_pct`
- `low_soc_pct`
- `stop_wait_pct`
- `thermal_load`
- `avg_temp_c`
- `battery_risk_score`
- `soc_rise_events`
- `gps_coverage_pct`
- baseline seeds for D2-D5

Returned archetype shape:

```json
{
  "label": "late_charger",
  "display_name": "Late Charger",
  "confidence": 0.64,
  "source": "baseline_seed",
  "reasons": ["baseline has frequent low-SOC events"],
  "policy": {
    "soc_warning_adjust_pct": 8,
    "route_buffer_multiplier": 1.12,
    "order_assignment_hint": "early_charging_nudge",
    "nudge_style": "early_warning"
  }
}
```

Important design decision:

- No `Driver.archetype` DB column was added yet.
- Archetype is derived dynamically because driver behavior can drift.
- The right persistent home for now is JSON payloads on nudges/decisions and future behavior snapshots, not a static driver column.

### 2.8 Weekly Reports

Implemented:

- Deterministic weekly report fallback
- Optional Groq-generated narrative
- Metric sanitization before LLM calls
- Optional Resend email delivery
- `send_email` query parameter on weekly report endpoint

Endpoint:

- `GET /api/v1/intelligence/reports/weekly?days=7`
- `GET /api/v1/intelligence/reports/weekly?days=7&send_email=true`

### 2.9 Auth, Roles, And Notifications

Implemented:

- Credentials login against backend
- Firebase ID token login
- Backend JWT
- NextAuth session carrying backend access token
- `trickee_admin`, `fleet_operator`, and `driver` role guards
- FCM token registration foundation
- Alert feed and resolve endpoint
- Charging/low-SOC alert foundations

---

## 3. Frontend Implemented

### 3.1 App Shell

Implemented:

- Login page
- NextAuth provider
- Firebase client setup
- Role-aware dashboard layout
- Sidebar/topbar
- Protected pages through `RoleGuard`
- Global floating live SOC badge on dashboard pages
- Subtle dashboard/card watermark treatment across production pages
- Frontend API request layer now caches the NextAuth backend token briefly, deduplicates concurrent GET calls, keeps short-lived GET responses, returns stale cached GET data immediately while refreshing in the background, applies a request timeout, and converts fetch/network failures into structured API errors instead of unhandled React runtime crashes.

### 3.2 Fleet And Vehicle Views

Implemented:

- Fleet overview from backend
- Fleet KPI bar
- Vehicle cards
- 3D horizontal vehicle carousel for fleet manager review
- Vehicle detail page
- V4.1 prediction trigger
- SOC/prediction chart
- Dynamic range and penalty breakdown
- Weekly report loading is no longer on the fleet page's critical first-render path; core fleet status renders first and the report fills in after.

### 3.3 Driver View

Implemented:

- Driver profile view
- Current vehicle status
- Live decision/nudge display
- Destination charge plan panel in nudges, including destination SOC need, current SOC, top-up SOC, charge time, and charger
- Driver behavior cards
- Trip history layout
- Driver role support through driver-scoped APIs

Remaining:

- Surface archetype label and confidence clearly in the driver profile UI.
- Bind active nudge card to latest persisted nudge event.

### 3.4 Route Intelligence

Implemented:

- Backend route scoring
- Admin/fleet driver selection
- Driver-scoped context
- Origin/destination coordinates from the map picker are now sent into `/routes/score`
- Selected-point route alternatives are generated from the chosen map points instead of always using the static Surat fallback names
- Ranked route cards
- Energy chart
- Reroute simulation
- Destination charge plan surfaced on route cards when the driver must top up before reaching the destination

Current backend route decisions now account for archetype-aware range buffers and exact destination charge plans in live driver decisions. The standalone `/routes/score` endpoint remains deterministic route scoring, but now returns charge minutes/top-up context when a route needs charging.

Important feasibility behavior:

- If `soc_start` is `0`, or every route would arrive below the safety buffer, the backend returns `route_status: "charge_required"`, `all_routes_infeasible: true`, and `recommended_route: null`.
- In that case, the ranked route cards are informational only and the nudge becomes the destination charge plan.
- `best_informational_route` is returned so the UI can still show the best comparison candidate without labeling it as a dispatch recommendation.
- The frontend now also infers infeasible state defensively if an older backend response omits `is_feasible`.

### 3.5 Live Fleet Map

Implemented:

- `/map` page
- `useDriverLocationWS`
- OpenStreetMap/Leaflet map using CARTO dark tiles for clearer production display
- OpenStreetMap iframe fallback behind the live overlay, so the user still sees a real map if Leaflet cannot initialize
- Leaflet dynamic imports are normalized for Next.js module/default export behavior, preventing the map from falling back to the projected grid when the module loads under `default`.
- Leaflet now has a CDN script/CSS fallback if the bundled dynamic import fails in production.
- Leaflet map containers, panes, and tiles have global CSS guards plus delayed `invalidateSize()` calls after dashboard layout settles, preventing collapsed tile panes during zoom/pan.
- Vehicle, charger, low-SOC, and stop-zone layers
- Selected-driver filter
- WebSocket status card
- REST polling fallback when WebSocket is disconnected
- Map REST fallback polling is non-overlapping, uses a longer timeout, and suppresses transient timeout/network messages when stale map data is already visible.
- Direct `vehicle_point` merge for fresh live GPS
- Latest DB row display when no live GPS event is arriving

### 3.6 Alerts, Scorecards, Admin, Reports

Implemented:

- Alerts page
- Scorecards page
- Admin/model metrics page
- 3D horizontal admin signal carousel for model/platform health
- Reports page
- Push-token registration UI foundation

Remaining:

- Surface archetype distribution in fleet/scorecard pages.
- Verify browser push notifications end to end in production.

---

## 4. Active API Surface

### Auth

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/firebase-login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/fcm-token`
- `DELETE /api/v1/auth/fcm-token`
- `POST /api/v1/auth/logout`

### Vehicles

- `GET /api/v1/vehicles`
- `GET /api/v1/vehicles/me`
- `GET /api/v1/vehicles/{vehicle_id}`
- `GET /api/v1/vehicles/{vehicle_id}/telemetry`

### Drivers

- `GET /api/v1/drivers`
- `GET /api/v1/drivers/me`
- `GET /api/v1/drivers/{driver_id}`
- `GET /api/v1/drivers/{driver_id}/trips`

### Telemetry

- `POST /api/v1/telemetry/evify`
- `POST /api/v1/telemetry/evify/bulk`

### Predictions

- `POST /api/v1/predictions/infer/{vehicle_id}`
- `GET /api/v1/predictions/{vehicle_id}/history`

### Routes

- `POST /api/v1/routes/score`
- `POST /api/v1/routes/reroute`

### Alerts

- `GET /api/v1/alerts`
- `POST /api/v1/alerts/{alert_id}/resolve`

### Intelligence

- `GET /api/v1/intelligence/drivers/{driver_id}/behavior`
- `GET /api/v1/intelligence/drivers/{driver_id}/live-profile`
- `GET /api/v1/intelligence/drivers/{driver_id}/live-decision`
- `POST /api/v1/intelligence/drivers/{driver_id}/live-decision`
- `GET /api/v1/intelligence/fleet/live`
- `GET /api/v1/intelligence/live-map`
- `GET /api/v1/intelligence/reports/weekly`
- `POST /api/v1/intelligence/context`
- `POST /api/v1/intelligence/wait-time`
- `POST /api/v1/intelligence/orders/assign`
- `POST /api/v1/intelligence/charging/decision`
- history endpoints for driver behavior, nudges, order assignments, charging decisions, and waits

### WebSocket

- `/ws/live-map?token=<backend-jwt>`
- `/ws/live-map?token=<backend-jwt>&driver_id=<driver-id>`

### Admin

- `GET /api/v1/admin/metrics`
- `GET /api/v1/admin/users`

---

## 5. Verification Status

Latest checks run locally on 2026-05-14:

- Backend targeted suite: `14 passed` for `tests/test_future_roadmap.py`
- Frontend `npx tsc --noEmit`: passed after the route feasibility/origin-destination, map display, and navigation latency work
- Frontend `npm run lint`: passed with existing unused-variable warnings after the route feasibility/origin-destination, map display, and navigation latency work

Warnings still present:

- Python deprecation warnings around `datetime.utcnow()`
- Frontend unused-variable warnings in:
  - `SocLineChart.tsx`
  - `ScoreGauge.tsx`
- Frontend `npm run build` hit a local Windows `.next/trace` `EPERM` file-lock issue; type-check and lint passed, so this appears environmental rather than a TypeScript/code failure.

New backend coverage added:

- `/routes/score` returns charge-required/no-recommendation state at zero SOC
- `/routes/score` uses selected origin/destination coordinates instead of only static fallback route names
- Driver archetype classifier baseline/live behavior
- Archetype-aware order assignment hint
- Live driver profile archetype response
- WebSocket role/driver scoping
- Weekly report email test isolation from local Resend env vars
- Destination charge plan assertions in route scoring and live driver decisions

---

## 6. Covered For Demo/Pilot

Strongly covered:

- Backend-connected frontend
- Role-based auth
- Vehicle/fleet dashboard
- Fleet manager 3D vehicle carousel
- Admin 3D model/platform signal carousel
- Global live SOC overlay across dashboard pages
- Premium watermark treatment on dashboard shell/cards
- V4.1 prediction
- Live driver profile
- Dynamic driver archetypes
- Archetype-aware live decisions
- Route scoring/reroute
- Exact destination charge planning with charge minutes, top-up SOC, charger, and arrival buffer
- Alerts feed
- Intelligence history foundations
- Wait/order/charging backend logic
- Live map with WebSocket plus REST fallback
- Direct live GPS map patching from telemetry ingest
- DB fallback for latest known location
- Dedicated wait/order/charging decision UI at `/decisions`
- 7-day route schedule UI at `/schedule`
- Real origin/destination map picker in route planning and schedule flows
- Archetype panels in driver and fleet dashboards
- Archetype confidence history persisted on `driver_behavior_snapshots`
- Optional Redis pub/sub live-map broadcast layer for multi-worker backends
- Production observability dashboard at `/observability`
- Data quality dashboard at `/data-quality`
- Model drift dashboard at `/model-drift`
- Pitch-style Evify/ABZO chart visuals and live Recharts equivalents in frontend
- Weekly report generation and optional email delivery
- Driver nudge UI for "charge to complete destination" guidance

Partially covered:

- True production streaming: in-memory WebSocket remains the default, with optional Redis fanout enabled by `REDIS_URL`.
- Live GPS source: backend can push when telemetry arrives, but still depends on Evify or a runner sending fresh telemetry.
- Archetype drift: confidence history is now persisted; automated confidence decay policy is still future work.
- Push notifications: foundations exist; production FCM flow still needs validation.
- Trips: inference exists, but quality depends on continuous telemetry and GPS quality.
- Nudges: destination charge-plan context is now visible in the route/driver UI, but latest persisted nudge binding and outcome capture remain incomplete.

Not fully built:

- Production log ingestion/source integration for the observability dashboard
- Full outcome capture forms for nudge/order/charging follow-through
- Automated archetype confidence decay and flip auditing
- Scorecard archetype coaching notes
- V6 training pipeline on longitudinal real outcomes

---

## 7. Remaining Work Before Pilot

### Highest Priority

1. **Verify live GPS end to end**
   - Send/replay Evify payload with changed non-zero GPS.
   - Confirm DB row is stored.
   - Confirm WebSocket sends `vehicle_point`.
   - Confirm map marker moves without waiting for REST polling.
   - Confirm reload shows latest DB row.

2. **Finish archetype coaching polish**
   - Driver profile and fleet page now show archetype panels.
   - `driver_behavior_snapshots` now stores archetype label/confidence/source/payload.
   - Remaining: scorecard coaching notes and explicit confidence-decay audit rules.

3. **Validate new dashboard flows with real data**
   - `/decisions`: wait/order/charging stack.
   - `/schedule`: 7-day route planning.
   - `/observability`: runtime counters and event history.
   - `/data-quality`: GPS/battery/freshness checks.
   - `/model-drift`: prediction error and archetype stability.

4. **Validate production backend URL**
   - Confirm Render `/health`.
   - Confirm Vercel `NEXT_PUBLIC_BACKEND_URL`.
   - Confirm WebSocket path works in deployed environment.

5. **Verify production auth and FCM**
   - Firebase login.
   - Backend JWT session.
   - Browser token registration.
   - Push alert receipt on deployed domain.

### Medium Priority

6. **Add telemetry replay/live runner if Evify live feed is not available**
   - Should post to `/api/v1/telemetry/evify`.
   - Useful for demoing map movement and archetype updates.

7. **Improve wait/order/charging UI**
   - Add manual outcome update controls.
   - Bind latest active nudge directly into driver view.
   - Add operator comments for ignored/followed decisions.
   - Validate destination charge-plan display against real charger rates and real route distance/ETA data.

8. **Improve live map context**
   - Add stale marker indication.
   - Show last live event timestamp per vehicle.
   - Preserve richer risk/archetype metadata on direct `vehicle_point` events.

9. **Outcome logging for V6**
   - Add or populate fields for:
     - followed/ignored
     - SOC before/after
     - route taken
     - delivery outcome
     - charging outcome
   - These become training labels for V6.

### Later Scale Work

10. **Shared live event bus hardening**
    - Optional Redis pub/sub exists through `REDIS_URL`.
    - Remaining: production Redis provisioning, retry metrics, and fanout load test.

11. **Time-series upgrade**
    - TimescaleDB or managed time-series storage when telemetry volume grows.

12. **V6 learning**
    - Driver embeddings.
    - Trip digital twin.
    - Outcome-learning personalization.
    - Bandit/RL-style nudge optimizer only after enough A/B outcome data.

---

## 8. V6 Direction

V6 is not needed for current personalization. Current archetypes provide immediate, explainable personalization.

V6 should come later, after enough longitudinal data exists:

- consistent `driver_id`
- GPS traces
- trip boundaries
- route outcomes
- charging outcomes
- nudge acknowledged/followed outcomes
- order assignment outcomes

Future V6 target:

```text
telemetry window + trip context + driver embedding -> personalized SOC/range/risk prediction
```

The current archetype layer is intentionally compatible with V6:

```text
current telemetry -> archetype -> policy weights -> recommendation -> outcome logging
future telemetry  -> embedding  -> policy weights -> recommendation -> outcome logging
```

So V6 can replace the classifier later without replacing the whole recommendation pipeline.

---

## 9. Deployment Notes

Frontend:

- Vercel app target remains `trickee-evify-live`.
- Production frontend URL referenced in config:
  - `https://trickee-evify-live.vercel.app`

Backend:

- Render remains the deployment target.
- Required env vars include:
  - `DATABASE_URL`
  - `SECRET_KEY`
  - `ALLOWED_ORIGINS`
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_SERVICE_ACCOUNT_JSON` or path equivalent
  - `FIREBASE_AUTH_ENABLED`
  - `FIREBASE_FCM_ENABLED`
  - optional `OPENWEATHER_API_KEY`
  - optional `GOOGLE_MAPS_API_KEY`
  - optional `GOOGLE_PLACES_API_KEY`
  - optional `GROQ_API_KEY`
  - optional `RESEND_API_KEY`
  - optional report email vars
  - optional `REDIS_URL` for multi-worker live-map fanout

Important:

- WebSockets must be supported by the deployed backend service.
- If backend is scaled to multiple workers/instances, set `REDIS_URL` so live GPS events fan out across workers.

---

## 10. Recommended Pilot Demo Flow

1. Login as admin/fleet operator.
2. Show Fleet Overview with latest backend telemetry.
3. Open Live Fleet Map.
4. Send/replay a telemetry payload with changed GPS.
5. Show marker move via direct WebSocket `vehicle_point`.
6. Refresh page and show latest DB row still appears.
7. Open Driver Profile and show archetype label/confidence.
8. Explain how archetype changes charging thresholds/range buffers.
9. Run V4.1 prediction on a vehicle.
10. Score a route and run reroute simulation.
11. Show weekly report.
12. Explain V6 path: archetype/outcome logs become the training memory for embeddings later.

---

## 11. Final Interpretation

The product now has a practical personalization bridge:

```text
Live telemetry -> driver profile -> archetype -> personalized rules -> persisted outcomes -> V6 later
```

This gives Trickee real driver personalization immediately, without pretending there is enough longitudinal data for a learned recommender. The next step is UI surfacing plus outcome logging, not a premature V6 model.
