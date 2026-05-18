# Trickee Implementation Status And Remaining Work

**Date:** 2026-05-17
**Scope:** Current FastAPI backend, Next.js frontend, Evify telemetry ingestion, live GPS/WebSocket flow, driver personalization, destination charge planning, dashboard presentation layer, recommender foundations, ML/intelligence services, deployment readiness, and remaining pilot gaps.

**Maintenance rule:** Whenever production code under `production/` changes, this file must be updated in the same work session so implementation status stays aligned with the actual codebase.

---

## 1. Current Architecture

Trickee is now a backend-connected EV intelligence platform with live telemetry support.

- **Frontend:** Next.js 14 App Router in `production/trickee-frontend`
- **Backend:** FastAPI in `production/backend`
- **Database:** SQLAlchemy relational schema, configured for Supabase/Postgres through `DATABASE_URL`
- **Auth:** Supabase Auth is the primary identity layer; the backend verifies Supabase JWTs and maps them to internal Trickee users, roles, fleets, and drivers. Legacy backend JWT/Firebase login remain rollback/optional paths only.
- **Live map:** OpenStreetMap/Leaflet with WebSocket updates and REST fallback
- **Telemetry:** Evify payload ingestion plus historical/backfill utilities
- **ML:** V4.1 SOC/range inference with V5/V6 learning foundations
- **Personalization:** Dynamic driver archetypes derived from live driver profile metrics
- **Destination charging:** Route/live decisions can tell a driver exactly how much SOC is needed, how many minutes to charge, and which charger to use before committing to a destination.
- **Notifications:** Dashboard alert feed is the reliable pilot channel; FCM/browser push foundations exist but need production receipt verification; WhatsApp is not implemented yet and is tracked as a future/fallback driver channel; Resend is used for report email, not live driver alerts.
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
- Central request/security middleware with request IDs, secure response headers, request-size limits, generic internal-error responses, and API rate limiting
- Redis-backed rate limiting when `REDIS_URL` is configured, with local in-process fallback
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
- `notifications`
- `assistant`
- `battery`
- `chargers`
- `fleet`
- `ws`

### 2.2 Database Schema

Implemented tables/foundations:

- `fleets`
- `users`
- `access_requests`
- `vehicles`
- `drivers`
- `telemetry`
- `predictions`
- `alerts`
- `trips`
- `device_push_tokens`
- `security_events`
- `driver_behavior_snapshots`
- `nudge_events`
- `order_assignment_decisions`
- `charging_decision_records`
- `wait_events`
- `ai_interaction_logs`
- `tool_call_logs`
- `notification_personalization_logs`
- `assistant_messages`
- `driver_profile_snapshots`
- `driver_coaching_events`
- `fleet_summary_logs`

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
  - `/ws/live-map?ticket=<short-lived-ws-ticket>`
  - `/ws/live-map?ticket=<short-lived-ws-ticket>&driver_id=<driver-id>`
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

Scale note:

- WebSocket connections are held in-memory per worker. Redis pub/sub fanout is implemented behind `REDIS_URL` so live GPS events can reach clients across multi-worker backends; production still needs Redis provisioning and fanout load testing.

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

- Supabase Auth as the primary production login/session path
- Backend Supabase JWT verification using `SUPABASE_JWT_SECRET`
- Internal user mapping by `users.supabase_user_id`, with email-link fallback for existing mapped users
- New Supabase users without an approved Trickee user mapping are recorded in `access_requests` and remain blocked until a `trickee_admin` approves role/fleet/driver access.
- Admin-managed access approval creates or updates the internal Trickee `users` mapping server-side; the frontend cannot self-assign admin, fleet, or driver permissions.
- Backend-owned RBAC/ABAC checks using `users.role`, `fleet_id`, and `driver_id`
- Legacy backend password login only when `LEGACY_AUTH_ENABLED=true`
- Optional Firebase ID token login when Firebase auth is enabled
- Short-lived WebSocket tickets for live-map connections
- Security event audit records for legacy/Firebase login success and failure paths
- `trickee_admin`, `fleet_operator`, and `driver` role guards
- FCM token registration foundation
- LLM-grounded notification personalization endpoint at `POST /api/v1/notifications/personalize`
- Notification personalization logs with fallback tracking
- Alert feed and resolve endpoint
- Charging/low-SOC alert foundations
- Current pilot notification channel is the dashboard alert/feed surface.
- WhatsApp/Twilio delivery is not implemented in production code yet. It is a recommended future fallback/high-priority channel for critical low-SOC alerts, charging opportunities, route-risk nudges, daily fleet summaries, and the conversational assistant.

Current LLM configuration:

- Trickee uses Groq through an OpenAI-compatible chat-completions endpoint when `GROQ_API_KEY` is configured.
- The configured model name is `GROQ_MODEL`; the current env/templates default to `llama-3.1-8b-instant`.
- If `GROQ_API_KEY` is blank or the model call fails/times out, all AI features fall back to deterministic backend wording.
- LLM output is used only for wording, explanations, summaries, and conversational composition. Backend services still compute decisions, ranks, risk, charger scoring, and driver/fleet facts.

### 2.10 AI Features 1-8

Implemented in `production/`:

- Shared AI service in `app/services/ai/llm_client.py`
  - model timeout
  - retry cap
  - token/output budget
  - prompt versioning
  - deterministic fallback text
  - safe logging without credentials
- Shared tool registry in `app/services/ai/tool_registry.py`
  - driver profile
  - vehicle state
  - battery prediction/range fallback
  - nearest charger
  - route score
  - trip history
  - fleet status
  - driver baseline
  - environment context
  - vehicle risk analysis
- Prompt-injection guard in `app/services/ai/safety.py`
- AI interaction/tool-call observability tables through Alembic migration `0009_ai_feature_logs`
- Database migration has been applied to the configured Postgres database; Alembic is now at `0009_ai_feature_logs (head)`.

Feature endpoints implemented:

- Feature 1: `POST /api/v1/notifications/personalize`
- Feature 2: `POST /api/v1/assistant/message`
- Feature 3: `POST /api/v1/routes/explain`
- Feature 4: `POST /api/v1/battery/insight`
- Feature 5: `POST /api/v1/chargers/recommend`
- Feature 6: `GET /api/v1/drivers/{driver_id}/profile`
- Feature 6: `POST /api/v1/drivers/{driver_id}/profile/update`
- Feature 7: `POST /api/v1/fleet/summary`
- Feature 8: `POST /api/v1/drivers/{driver_id}/coaching`

Production behavior:

- All endpoints require authenticated backend access.
- Driver/vehicle/fleet IDs are checked server-side before tool calls run.
- Unknown request fields are rejected through Pydantic `extra="forbid"` models.
- Assistant messages, notification personalization, route explanations, charger recommendations, fleet summaries, and coaching generation have Redis-backed rate limits with local fallback.
- Charger recommendations explicitly mark real-time availability as unconfirmed unless a real availability provider is integrated.
- Safety-critical assistant messages are escalated without LLM-generated mechanical advice.
- LLM-generated text is clamped and grounded in tool outputs; if no tool succeeds, assistant returns a safe fallback.

Current implementation caveat:

- This is production-safe AI orchestration and deterministic recommendation support, not a fully trained recommender system deployment. For pilot/pitch, use these as grounded assistive features and mark learned recommender/RL behavior as locked future learning until real outcome data exists.

---

## 3. Frontend Implemented

### 3.1 App Shell

Implemented:

- Login page
- Supabase-backed auth provider
- Firebase client setup
- Role-aware dashboard layout
- Sidebar/topbar
- Protected pages through `RoleGuard`
- Global floating live SOC badge on dashboard pages
- Subtle dashboard/card watermark treatment across production pages
- Frontend API request layer now caches the Supabase access token briefly, deduplicates concurrent GET calls, keeps short-lived GET responses, returns stale cached GET data immediately while refreshing in the background, applies a request timeout, and converts fetch/network failures into structured API errors instead of unhandled React runtime crashes.

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

### 3.7 AI Workspace

Implemented:

- `/ai` dashboard workspace for admin, fleet operator, and driver roles
- Assistant chat surface
- Notification personalization preview
- Route explanation runner
- Battery insight runner
- Charger recommendation runner
- Driver profile memory view/update runner
- Fleet summary runner
- Driver coaching runner
- Loading, empty, error, fallback, driver selection, and vehicle selection states
- Frontend API client support for all Feature 1-8 endpoints
- Sidebar/topbar navigation entry as `Assistant`

Design note:

- The UI exposes product outcomes and grounded results. It does not expose internal prompts, system instructions, API keys, service role secrets, or raw model internals.

Remaining:

- Surface archetype distribution in fleet/scorecard pages.
- Verify browser push notifications end to end in production.

---

## 4. Active API Surface

### Auth

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/firebase-login`
- `POST /api/v1/auth/access-request`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/fcm-token`
- `DELETE /api/v1/auth/fcm-token`
- `POST /api/v1/auth/logout`
- `GET /api/v1/admin/access-requests`
- `POST /api/v1/admin/access-requests`
- `POST /api/v1/admin/access-requests/{request_id}/approve`
- `POST /api/v1/admin/access-requests/{request_id}/reject`
- `GET /api/v1/admin/fleets`
- `GET /api/v1/admin/drivers`

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
- `GET /api/v1/drivers/{driver_id}/profile`
- `POST /api/v1/drivers/{driver_id}/profile/update`
- `POST /api/v1/drivers/{driver_id}/coaching`

### Telemetry

- `POST /api/v1/telemetry/evify`
- `POST /api/v1/telemetry/evify/bulk`

### Predictions

- `POST /api/v1/predictions/infer/{vehicle_id}`
- `GET /api/v1/predictions/{vehicle_id}/history`

### Routes

- `POST /api/v1/routes/score`
- `POST /api/v1/routes/reroute`
- `POST /api/v1/routes/explain`

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

### AI Features

- `POST /api/v1/notifications/personalize`
- `POST /api/v1/assistant/message`
- `POST /api/v1/battery/insight`
- `POST /api/v1/chargers/recommend`
- `POST /api/v1/fleet/summary`

### WebSocket

- `/ws/live-map?ticket=<short-lived-ws-ticket>`
- `/ws/live-map?ticket=<short-lived-ws-ticket>&driver_id=<driver-id>`

### Admin

- `GET /api/v1/admin/metrics`
- `GET /api/v1/admin/users`

---

## 5. Verification Status

Latest checks run locally on 2026-05-17:

- Backend full suite through local `.venv`: `41 passed`
- Focused H3/external-context + AI feature suite: `27 passed`
- Backend syntax compile: passed
- Frontend `npm run lint`: passed with no warnings or errors
- Frontend `npm run build`: previously passed; latest local rerun hit the Windows `.next/trace` file-lock issue while local Next dev processes were active, before reaching a source compile error.
- Alembic migration against configured Postgres: upgraded to `0009_ai_feature_logs (head)`
- AI log table existence check: `ai_interaction_logs`, `tool_call_logs`, `notification_personalization_logs`, `assistant_messages`, `driver_profile_snapshots`, `driver_coaching_events`, and `fleet_summary_logs` all exist
- Deployed Vercel frontend `/login`: HTTP 200
- Deployed Vercel Firebase service worker `/firebase-messaging-sw.js`: HTTP 200 and contains Firebase messaging code
- Full production FCM receipt remains unverified because it requires an authenticated deployed browser session, notification permission, FCM token registration, and a live push event

Warnings still present:

- Python deprecation warnings around `datetime.utcnow()`

New backend coverage added:

- `/routes/score` returns charge-required/no-recommendation state at zero SOC
- `/routes/score` uses selected origin/destination coordinates instead of only static fallback route names
- Driver archetype classifier baseline/live behavior
- Archetype-aware order assignment hint
- Live driver profile archetype response
- WebSocket role/driver scoping
- Weekly report email test isolation from local Resend env vars
- Destination charge plan assertions in route scoring and live driver decisions
- AI feature evals:
  - notification sentence limit
  - prompt-injection detection
  - assistant battery intent tool usage
  - safety-critical escalation
  - battery insight grounding
  - charger availability honesty
  - driver profile confidence scoring
  - fleet summary fact alignment
  - non-shaming driver coaching
- External-context H3/cache evals:
  - H3 bucket is used when the H3 library is available
  - nearby route calls reuse one cached Directions result
  - provider quota guard blocks new Google calls after the configured daily limit

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
- Grounded AI Feature 1-8 backend endpoints
- `/ai` Assistant workspace for running assistant, notifications, route reasoning, battery insight, charger recommendation, driver profile memory, fleet summary, and driver coaching flows
- AI/tool observability tables applied in Postgres

Partially covered:

- True production streaming: in-memory WebSocket remains the default, with optional Redis fanout enabled by `REDIS_URL`.
- Live GPS source: backend can push when telemetry arrives, but still depends on Evify or a runner sending fresh telemetry.
- Archetype drift: confidence history is now persisted; automated confidence decay policy is still future work.
- Push notifications: FCM service worker is deployed and token registration foundation exists; full push receipt on the deployed domain still needs interactive validation.
- Trips: inference exists, but quality depends on continuous telemetry and GPS quality.
- Nudges: destination charge-plan context is now visible in the route/driver UI, but latest persisted nudge binding and outcome capture remain incomplete.
- Recommender systems: deterministic scoring/profile/recommendation services are implemented; learned recommender/RL behavior should remain soft-locked until pilot outcome data exists.

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
   - Supabase login/session refresh.
   - Backend Supabase JWT mapping to Trickee user scope.
   - Optional Firebase login path if enabled.
   - Browser token registration.
   - Push alert receipt on deployed domain.
   - Current status: Vercel `/login` and `/firebase-messaging-sw.js` are reachable; actual push receipt still requires a logged-in browser, notification permission, registered token, and live alert send.

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
  - `ENVIRONMENT`
  - `SUPABASE_JWT_SECRET`
  - `SUPABASE_JWT_AUDIENCE`
- `MAX_REQUEST_BODY_BYTES`
- rate-limit settings for auth, telemetry, intelligence, AI, and WebSocket tickets
  - AI settings:
    - `GROQ_API_KEY`
    - `GROQ_MODEL`
    - `AI_REQUEST_TIMEOUT_SECONDS`
    - `AI_MAX_RETRIES`
    - `AI_MAX_INPUT_CHARS`
    - `AI_MAX_OUTPUT_TOKENS`
    - `ASSISTANT_RATE_LIMIT_PER_HOUR`
    - `NOTIFICATION_PERSONALIZATION_RATE_LIMIT_PER_HOUR`
    - `CHARGER_RECOMMENDATION_RATE_LIMIT_PER_HOUR`
    - `ROUTE_EXPLANATION_RATE_LIMIT_PER_HOUR`
    - `FLEET_SUMMARY_RATE_LIMIT_PER_HOUR`
    - `COACHING_RATE_LIMIT_PER_DAY`
  - external-context cache/quota settings for Google/OpenWeather API cost control:
    - `EXTERNAL_CONTEXT_H3_ENABLED`
    - `EXTERNAL_CONTEXT_H3_RESOLUTION`
    - `EXTERNAL_CONTEXT_WEATHER_H3_RESOLUTION`
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_SERVICE_ACCOUNT_JSON` or path equivalent
  - `FIREBASE_AUTH_ENABLED`
  - `FIREBASE_FCM_ENABLED`
  - optional `OPENWEATHER_API_KEY`
  - optional `GOOGLE_MAPS_API_KEY`
  - optional `GOOGLE_PLACES_API_KEY`
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
12. Open `/ai` and show assistant, route explanation, battery insight, charger recommendation, fleet summary, and coaching outputs.
13. Explain V6 path: archetype/outcome logs become the training memory for embeddings later.

Pitch guidance:

- Do not mock learned recommender/RL behavior as deployed. Soft-lock it as "learning mode" or "pilot data collection" and show the deterministic grounded decision stack that is actually implemented.
- For demoing future recommender UX, label screens as simulation/pilot preview and keep outputs tied to real backend facts.
- The current website can be used on mobile Chrome as a PWA-style responsive web app. Mobile Chrome can request GPS through the browser Geolocation API on HTTPS, but driver background tracking, reliable push behavior, and OS-level location permissions are better handled by a native wrapper or dedicated mobile app later.
- H3 spatial indexing is now implemented in the backend external-context cache layer. It reduces Places/Directions/Elevation/OpenWeather cost by caching nearby requests per hex cell and deduplicating moving-vehicle requests. It does not reduce the price of a single Google call, but it reduces call volume when many nearby requests hit the same cell.

---

## 11. Final Interpretation

The product now has a practical personalization bridge:

```text
Live telemetry -> driver profile -> archetype -> personalized rules -> persisted outcomes -> V6 later
```

This gives Trickee real driver personalization immediately, without pretending there is enough longitudinal data for a learned recommender. The next step is UI surfacing plus outcome logging, not a premature V6 model.

---

## 12. Latest Production Fixes - Real-Time Reports And PWA

Implemented in `production/`:

- Added backend `GET /api/v1/intelligence/reports/charts` for DB-backed reporting data scoped to admin/fleet roles.
- Replaced static report chart images with live Recharts views using telemetry, prediction, wait, and charging-decision data from the database.
- Added report time-window filters: 24 hours, 7 days, 10 days, 14 days, and 30 days.
- Updated the embedded telemetry chart component to use the same live chart endpoint instead of generated/static chart arrays.
- Added PWA support with a Next manifest, production service worker registration, and a conservative shell cache.
- Kept live/report refreshes on a 30-second visibility-aware polling path, matching the production rule against fast blind polling.

Verification completed:

- Backend tests: `28 passed`
- Frontend lint: passed
- Frontend production build: passed
- Production diff whitespace check: passed

---

## 13. Latest Production Fixes - Auth Page UX

Implemented in `production/trickee-frontend`:

- Rebuilt `/login` with a restrained premium UI, accessible form controls, password visibility toggle, clear auth errors, and role-aware post-login routing.
- Added `/signup` as a Supabase-backed account creation flow with full name, company/fleet, work email, password validation, confirmation handling, and explicit pending-role-mapping state.
- Preserved the production auth boundary: Supabase owns identity, while the Trickee backend still owns role, fleet, and driver authorization.
- Kept legacy password login only as the existing rollback path when the environment flag enables it.
- Revised visible auth-page copy to remove implementation terms and keep the product UI concise, human, and operations-focused.

Verification completed:

- Frontend lint: passed
- Frontend production build: passed

---

## 14. Latest Production Fixes - Product Copy Pass

Implemented in `production/trickee-frontend`:

- Applied the premium product-copy rule across the main dashboard pages and shared components.
- Removed visible implementation wording such as backend, API, WebSocket, fallback, endpoint, V6, and AI-error phrasing from user-facing UI.
- Renamed operational navigation and page labels toward clearer product language:
  - AI Predictions -> Vehicle Forecasts
  - Report Charts -> Reports
  - Observability -> Operations Health
  - Model Drift -> Model Health
- Reworked route, map, driver, vehicle, data quality, admin, scorecard, and decision-page helper copy to be shorter, calmer, and user-outcome focused.

Verification target:

- Frontend lint
- Frontend production build

---

## 15. Latest Production Fixes - Google And Code Sign-In

Implemented in `production/trickee-frontend`:

- Added Google sign-in to `/login` and `/signup`.
- Added one-time-code sign-in on `/login` for work email and mobile number.
- Added verification-code entry and session handoff after successful code verification.
- Added `/auth/callback` route for completing Google sign-in and returning users to the workspace.
- Kept product UI copy clean: no provider architecture, token, or implementation wording is shown to users.

Operational note:

- Google and mobile-code sign-in require the corresponding providers to be enabled in the Supabase project dashboard.

Verification completed:

- Frontend lint: passed
- Frontend production build: passed

---

## 16. Latest Production Feature - Daily Impact Report

Implemented in `production/`:

- Added backend daily impact generation at `GET /api/v1/intelligence/reports/daily-impact`.
- Added deterministic impact calculation from persisted operational records:
  - completed trips
  - charging decision records
  - order assignment decisions
  - alerts
  - nudge events
  - wait events
  - telemetry row coverage
- Added per-driver and fleet-level summaries for:
  - operating value
  - time saved
  - orders delivered
  - useful charging minutes
  - charging value captured
  - extra order capacity
  - low-SOC risks cleared
  - acknowledged driver actions
- Added evidence metadata so report values are grounded in database records instead of free-form generated text.
- Added `Daily Impact` dashboard page at `/impact` for admin, fleet operator, and driver roles.
- Added sidebar and topbar navigation for `Daily Impact`.
- Added frontend API client support through `api.intelligence.dailyImpact(reportDate)`.
- Kept UI copy concise and product-facing, with no backend/tooling terminology exposed to users.

Production behavior:

- Admin users see all scoped drivers.
- Fleet operators see their fleet drivers.
- Drivers see their own impact report.
- The report uses 30-second visibility-aware refresh through the existing frontend polling helper.
- No new database table was added in this pass; the feature is computed from existing operational records for rollback safety.

Verification completed:

- Backend focused test: passed
- Backend full test suite: `31 passed`
- Frontend lint: passed
- Frontend production build: passed

---

## 17. Latest Production Hardening - Security, Abuse Controls, And Auth Truth-Up

Implemented in `production/`:

- Added backend security middleware for request IDs, secure response headers, request-size limits, generic internal-error responses, and response timing headers.
- Restricted backend CORS methods/headers to the methods and headers actually used by the app.
- Added Redis-backed rate limiting with local fallback:
  - global API limit
  - auth/login limit
  - telemetry ingest limits
  - prediction inference limit
  - intelligence workflow limits
  - WebSocket ticket limit
  - FCM token registration limit
- Added external-context cost protection for Google/OpenWeather calls:
  - Google Places, Directions, and Elevation calls share a daily provider quota guard.
  - OpenWeather calls have a separate daily provider quota guard.
  - Google/OpenWeather results are cached in-process and, when `REDIS_URL` is configured, cached across workers.
  - Directions use a 5-minute spatial cache, charger lookups use a 20-minute spatial cache, elevation uses a 24-hour spatial cache, and weather uses a 10-minute spatial cache.
  - Cache keys now use Uber H3 hex cells when `h3` is installed and `EXTERNAL_CONTEXT_H3_ENABLED=true`; they fall back to rounded lat/lng grid keys if H3 is unavailable during a partial deploy.
  - Default H3 settings: `EXTERNAL_CONTEXT_H3_RESOLUTION=10` for chargers/directions/elevation and `EXTERNAL_CONTEXT_WEATHER_H3_RESOLUTION=6` for weather. Lowering charger/directions resolution to 8-9 can reduce API calls further but may serve coarser context.
  - When quota is exhausted, the backend serves stale cached context if available, otherwise deterministic fallback context.
  - The 5-second live-map WebSocket path does not call Google APIs; it uses DB telemetry, clustering, and static charger context.
- Shortened legacy backend JWT expiry to 15 minutes and blocked `LEGACY_AUTH_ENABLED=true` when `ENVIRONMENT=production`.
- Added strict Pydantic request contracts with unknown-field rejection for auth, route scoring, wait-time, order-assignment, charging-decision, live-decision, and telemetry wrapper payloads.
- Normalized the decision API contract so frontend `current_location`/`pickup_location` payloads safely map to the charging engine's server-side `location`/`restaurant_location` contract.
- Added server-side scope validation for order-assignment and charging-decision driver/vehicle references before decisions are persisted.
- Added `security_events` audit table and login security-event recording for legacy/Firebase auth paths.
- Added Supabase-only RLS baseline migration when the target database exposes the `auth` schema.
- Added secure frontend headers and CSP through Next.js config, with production browser source maps disabled.
- Removed React fallback-map `dangerouslySetInnerHTML` usage; Leaflet marker HTML remains generated server-trusted/sanitized for `divIcon`.
- Gated legacy `localStorage` token usage behind `NEXT_PUBLIC_LEGACY_AUTH_ENABLED=true`.
- Hardened Docker runtime by running the backend container as a non-root user.
- Updated backend env templates and README for the new production controls.

Verification completed:

- Backend full test suite: `31 passed`
- External-context cache/quota regression tests: passed as part of backend suite
- Backend syntax compile: passed
- Frontend lint: passed
- Frontend production build: passed

---

## 18. Latest Production Feature - Grounded AI Features 1-8

Implemented in `production/`:

- Added shared AI infrastructure:
  - `app/services/ai/llm_client.py`
  - `app/services/ai/safety.py`
  - `app/services/ai/tool_registry.py`
  - `app/services/ai_features.py`
- Added grounded AI/product endpoints:
  - `POST /api/v1/notifications/personalize`
  - `POST /api/v1/assistant/message`
  - `POST /api/v1/routes/explain`
  - `POST /api/v1/battery/insight`
  - `POST /api/v1/chargers/recommend`
  - `GET /api/v1/drivers/{driver_id}/profile`
  - `POST /api/v1/drivers/{driver_id}/profile/update`
  - `POST /api/v1/fleet/summary`
  - `POST /api/v1/drivers/{driver_id}/coaching`
- Added AI observability/storage migration `0009_ai_feature_logs`.
- Applied migrations to the configured Postgres database; Alembic is at `0009_ai_feature_logs (head)`.
- Added frontend `/ai` workspace and navigation entry.
- Added frontend API client methods for Feature 1-8 flows.
- Added focused AI eval tests in `backend/tests/test_ai_features.py`.

LLM in use:

- Provider path: Groq OpenAI-compatible chat-completions endpoint.
- Model setting: `GROQ_MODEL`.
- Current default: `llama-3.1-8b-instant`.
- Fallback: deterministic backend wording when `GROQ_API_KEY` is absent, the call times out, or model output fails safety/grounding constraints.

Security and production rules enforced:

- LLM never decides send/no-send, route ranking, charging rank, fleet risk, or driver score.
- Tool outputs ground notification wording, assistant answers, route explanations, battery insight, charger explanations, fleet summaries, and coaching messages.
- Assistant safety-critical messages escalate without mechanical advice.
- Prompt-injection text is treated as untrusted.
- Charger availability is never faked; responses say availability is not confirmed unless a real slot provider is integrated.
- AI/tool calls are logged with latency, fallback, success/failure, feature name, and tool names.
- Redis-backed rate limits are used when `REDIS_URL` is set, with local fallback.

FCM deployment status checked:

- `https://trickee-evify-live.vercel.app/login` returned HTTP 200.
- `https://trickee-evify-live.vercel.app/firebase-messaging-sw.js` returned HTTP 200 and contains Firebase messaging code.
- Full push receipt is still not marked complete because it requires a logged-in browser, notification permission, token registration, and an actual alert push on the deployed domain.

Notification-channel status:

- **Primary now:** dashboard alert feed and persisted alert/nudge records.
- **Built foundation:** FCM service worker, browser token registration endpoint, and personalized notification wording endpoint.
- **Needs verification:** end-to-end production FCM delivery from deployed backend/frontend.
- **Not implemented yet:** WhatsApp delivery. Recommended later as opt-in fallback/high-priority delivery, not as the core decision system.

Verification completed:

- Backend full test suite: `41 passed`
- Backend syntax compile: passed
- Alembic current: `0009_ai_feature_logs (head)`
- AI log table existence check: passed
- Frontend lint: passed
- Frontend production build: passed

Render deployment note:

- The configured Postgres database was migrated locally to `0009_ai_feature_logs`.
- If Render is still running a Git commit that does not contain `alembic/versions/0009_ai_feature_logs.py`, Render will log `Can't locate revision identified by '0009_ai_feature_logs'`.
- That does not mean the local code was deployed to Render. It means the database revision moved ahead of the code currently checked out by the Render service.
- Production-safe fix: push the migration/code to the Git branch Render deploys from, then redeploy Render. Avoid stamping the database backward unless intentionally rolling back with a tested rollback plan.

---

## 19. Latest Production Hardening - H3 External API Cost Control

Implemented in `production/backend`:

- Added `h3==4.1.2` to backend requirements.
- Added environment settings:
  - `EXTERNAL_CONTEXT_H3_ENABLED=true`
  - `EXTERNAL_CONTEXT_H3_RESOLUTION=10`
  - `EXTERNAL_CONTEXT_WEATHER_H3_RESOLUTION=6`
- Updated `app/services/external_context.py` so charger, Directions, Elevation, and weather cache keys use H3 hex cells when available.
- Kept a rounded-grid fallback if H3 is disabled or unavailable, so startup does not fail during partial dependency/deploy mismatch.
- Preserved existing TTLs and quota behavior:
  - chargers: 20 minutes
  - Directions: 5 minutes
  - Elevation: 24 hours
  - weather: 10 minutes
- Kept Google provider quota protection and stale-cache fallback unchanged.

Cost-control interpretation:

- H3 reduces repeated Google/OpenWeather calls while a driver moves within the same spatial bucket, or when multiple nearby drivers/operators request similar charger/route context.
- H3 does not make an individual Google Places call cheaper; it reduces total call volume.
- Resolution 10 is conservative for pilot accuracy. For a higher cost-saving mode, test resolution 8 or 9 against charger density and route precision before changing production env vars.

Render/Alembic status:

- Local configured Postgres is already at `0009_ai_feature_logs (head)`.
- Render can only see migrations that exist in the Git commit it deploys. The current Render error is expected if the database was migrated locally before the migration file was pushed and redeployed.
- Required deployment sequence now: push code including `0009_ai_feature_logs.py`, the shortened `0008_security_rls` migration revision change, AI feature code, and H3 changes -> redeploy Render -> confirm `/health` and `alembic current` in Render logs.

Verification completed:

- Backend focused suite: `27 passed` for `tests/test_future_roadmap.py` and `tests/test_ai_features.py`

---

## 20. Latest Production Hardening - Config Defaults And Archived API Review

Reviewed archived file:

- `Trickee/aicodeold/api (1).py` is historical Flask prototype code and must not be used as a production API.
- Useful concepts from it are already present in production in safer form:
  - destination reachability is covered by route scoring, live decisions, destination charge planning, and battery insight flows
  - Google Directions context is covered by `app/services/external_context.py` with timeout, cache, quota guard, fallback, and H3 bucketing
  - CSV/Evify field normalization is covered by the production telemetry ingestion adapter
- Unsafe prototype behavior was not carried forward:
  - no hardcoded API key in production source
  - no Flask debug API
  - no unauthenticated `/predict` endpoint
  - no raw stack-trace responses
  - no random model accuracy claims

Implemented in `production/backend`:

- `Settings` still keeps local development defaults for `DATABASE_URL` and `ALLOWED_ORIGINS`, but production now refuses to boot with SQLite when `ENVIRONMENT=production`.
- `.env.production.example` now points `ALLOWED_ORIGINS` at `https://trickee-evify-live.vercel.app`.

Operational note:

- Render/Supabase production values must come from environment variables, not from defaults in `config.py`.
- Local `.env` files contain real credentials in the developer workspace and must not be committed. Any key that was ever hardcoded in archived code should be rotated before pilot.

---

## 21. Latest Local Dev Fix - Next.js CSP React Refresh

Implemented in `production/trickee-frontend`:

- Updated `next.config.mjs` so local development CSP includes `unsafe-eval` only when `NODE_ENV !== "production"`.
- Production CSP remains stricter and does not allow `unsafe-eval`.

Why:

- Next.js dev mode uses React Refresh/Webpack runtime code that requires eval-like behavior.
- Without the development-only exception, local pages can load HTML but fail to execute `main-app.js` under the browser's CSP.

---

## 22. Latest Frontend Feature - Premium Public Landing Page

Implemented in `production/trickee-frontend`:

- Replaced the root `/` redirect with a premium public landing page.
- Added GSAP-powered entrance, scroll reveal, parallax, counter, and product-scene motion.
- Added Lenis smooth scrolling for the public landing page.
- Added direct routes into existing product surfaces:
  - `/signup`
  - `/login`
  - `/fleet`
  - `/map`
  - `/routes`
  - `/decisions`
  - `/ai`
  - `/impact`
  - `/reports`
- Updated site metadata to match the public positioning.

Design notes:

- Palette follows the existing Trickee dark graphite, refined teal, blue, and white-on-black system.
- The landing page uses a full product cockpit scene instead of a disconnected marketing illustration.
- Hero typography was tightened after visual review: headline size, line-height, supporting copy, and desktop grid ratio were reduced so the hero feels sleeker and no longer overwhelms the product scene.
- Production CSP remains strict; local dev CSP still has the development-only React Refresh exception.

Verification completed:

- Frontend lint: passed.
- Frontend type check: passed.
- Frontend production build: passed.
- Local route checks returned HTTP 200 for `/`, `/login`, `/signup`, `/fleet`, `/map`, `/routes`, `/decisions`, `/ai`, `/impact`, and `/reports`.
- Landing page `_next/static` CSS and JavaScript assets returned correct MIME types.

---

## 23. Latest Auth/Admin Hardening - Workspace Access Approval

Implemented in `production/backend`:

- Added `AccessRequest` ORM model and Alembic migration `0010_access_requests`.
- Applied `alembic upgrade head` to the configured Postgres database; Alembic advanced from `0009_ai_feature_logs` to `0010_access_requests`.
- Added public access request intake at `POST /api/v1/auth/access-request`.
- Added automatic pending-request recording when a valid Supabase identity exists but no approved internal Trickee user mapping exists.
- Added admin-only access review endpoints:
  - `GET /api/v1/admin/access-requests`
  - `POST /api/v1/admin/access-requests`
  - `POST /api/v1/admin/access-requests/{request_id}/approve`
  - `POST /api/v1/admin/access-requests/{request_id}/reject`
  - `GET /api/v1/admin/fleets`
  - `GET /api/v1/admin/drivers`
- Approval validates role, fleet, and driver relationships server-side before creating/updating the internal `users` row.
- Admin approval/rejection actions write `security_events` audit records.
- Supabase identity remains separate from Trickee authorization: identity proves the person, the backend grants workspace access.

Implemented in `production/trickee-frontend`:

- Signup now captures requested access type: fleet manager or driver.
- Signup and unmapped login paths submit a pending workspace access request.
- Password login now falls back to the legacy demo account path only when `NEXT_PUBLIC_LEGACY_AUTH_ENABLED=true`; this keeps pilot/demo users usable while preserving the Supabase approval gate for real workspace users.
- Admin console now includes:
  - workspace request queue
  - manual request creation
  - role selector
  - fleet selector
  - driver selector for driver access
  - approve/reject actions
  - recent review list
- Removed visible public/product copy that said `Trickee AI` in auth/sidebar brand surfaces; public UI now uses `Trickee`.
- Body/UI font is Inter.
- Display/headline font is Space Grotesk for the large bold landing/auth/admin headings.
- Removed the temporary `geist` package after switching to the requested Inter + Space Grotesk typography pair.

Verification completed:

- Backend focused auth suite: `3 passed`
- Frontend lint: passed
- Frontend production build: passed

---

## 24. Latest Deployment Runbook And Notification Channel Clarification

Documentation added:

- Created `Trickee/analysis/deploy_steps.md`.
- The runbook now documents:
  - Supabase Auth email setup through Resend SMTP
  - Backend report email setup through Resend API
  - Google OAuth setup in GCP
  - Supabase redirect URLs
  - Vercel production environment variables
  - Render production environment variables
  - Supabase custom email/password admin strategy
  - demo user creation and role-mapping SQL for:
    - `admin@trickee.ai` as `trickee_admin`
    - `fleet@evify.in` as `fleet_operator`
    - `driver1@evify.in` as `driver`

Production env/config status:

- Vercel production env values were updated for:
  - `NEXT_PUBLIC_BACKEND_URL=https://trickee-evify-production.onrender.com/api/v1`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_LEGACY_AUTH_ENABLED=false`
- `render.yaml` was expanded so Render has explicit production placeholders/defaults for:
  - `ENVIRONMENT=production`
  - `SUPABASE_JWT_SECRET`
  - `SUPABASE_JWT_AUDIENCE=authenticated`
  - `LEGACY_AUTH_ENABLED=false`
  - H3 external-context settings
  - AI/Groq rate/budget settings
  - Resend report-email settings
  - Redis URL
- Live Render secret values still need to be entered in the Render dashboard or through an authenticated Render API/CLI session.
- The critical backend auth variables are:
  - `DATABASE_URL`
  - `SECRET_KEY`
  - `SUPABASE_JWT_SECRET`
  - `SUPABASE_JWT_AUDIENCE=authenticated`
  - `LEGACY_AUTH_ENABLED=false`

WhatsApp decision:

- WhatsApp is beneficial for pilot because drivers already use it and it can improve visibility for critical nudges.
- WhatsApp is **not currently implemented** in the production notification layer.
- Recommended role: opt-in fallback/high-priority delivery channel for:
  - critical low-SOC warnings
  - charging opportunities
  - route-risk alerts
  - daily fleet summaries
  - driver coaching summaries
  - future conversational EV assistant
- It should not replace backend alert decisions, dashboard alerts, or FCM. The production shape should remain:

```text
Backend decision/alert engine
  -> dashboard alert/feed
  -> FCM/browser push when verified
  -> WhatsApp fallback/high-priority channel when configured
```

WhatsApp constraints to plan for:

- Driver opt-in/consent required.
- Meta WhatsApp Business template approval required for proactive outbound messages.
- 24-hour customer-service window applies.
- Per-message cost applies.
- Abuse controls and nudge frequency caps are required to avoid drivers muting alerts.

Auth debugging improvement:

- Backend auth now distinguishes between invalid/unverified credentials and valid Supabase identity without Trickee workspace approval.
- `/api/v1/auth/me` now returns:
  - `401` when the token cannot be validated, usually `SUPABASE_JWT_SECRET`, audience, missing authorization header, or Supabase project mismatch.
  - `403` when the Supabase identity is valid but the internal Trickee `users` mapping is missing/inactive/deleted.
- Frontend login copy now treats `403 Workspace access is pending approval` as the workspace approval case and treats other auth failures as session verification problems.
- Verification completed:
  - backend focused auth suite: `3 passed`
  - frontend lint: passed
  - frontend production build: passed
