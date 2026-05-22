# Trickee Implementation Status And Remaining Work
**Last reconciled:** 2026-05-22
**Codebase checked:** `production/backend`, `production/trickee-frontend`, Alembic migrations, Evify Data 7.0 shape
**Purpose:** Current source-of-truth for what is actually built, what is partially built, and what remains before pilot.

---

## 0. Document Precedence

The latest planning files are newer than the older PRDs and override conflicting historical claims:

| Source | Last modified | How to treat it |
|---|---:|---|
| `latest_features_prd.md` | 2026-05-18 22:58 | Primary feature roadmap |
| `chatfindings/2026-05-17_ev_mobility_intelligence_decision_findings.md` | 2026-05-18 22:57 | Primary strategy and EV intelligence reasoning |
| `trickee_req.md` | 2026-05-01 11:24 | Original challenge brief only |
| `trickee_platform_prd.md` | 2026-05-01 11:24 | Historical platform PRD; current stack differs in auth and deployment details |
| `trickee_next_stage_analysis.md` | 2026-05-01 11:24 | Historical next-stage planning |
| `future_roadmapv2.md` | 2026-05-01 11:24 | Historical roadmap |
| `current_state_and_roadmap.md` | 2026-05-01 11:24 | Historical baseline; latest pilot architecture decisions supersede it |

Resolved conflicts:

- Current pilot architecture is **FastAPI REST ingest + GCP Cloud SQL Postgres + Redis live state + WebSocket**, not MQTT/TimescaleDB by default.
- MQTT/TimescaleDB/worker architecture remains a post-pilot scale path for 500-600 vehicles.
- Current production identity direction is **Supabase Auth plus backend workspace approval**, not NextAuth as the older PRD says.
- Firebase is currently used/planned mainly for FCM/browser push and optional Firebase auth support, not as the primary production workspace authorization source.
- Evify does not need to provide `trip_id`; Trickee should generate trips.
- Evify Data 7.0 has no real `driver_id`; pilot can use `RegNo` or `VehicleId` as a temporary behavior-profile proxy, but this is not a true human-driver identity.

---

## 1. Current Architecture

Current production/pilot architecture:

```text
Evify JSON telemetry
  -> FastAPI telemetry ingest
  -> Evify adapter normalization
  -> derived physics fields
  -> GCP Cloud SQL Postgres telemetry/history tables
  -> Redis live-state/cache/pub-sub/rate-limit layer
  -> dashboard APIs, WebSocket live map, predictions, alerts, intelligence services
```

Current scale architecture decision:

- Use current REST + GCP Cloud SQL Postgres + Redis stack for 50-100 vehicle pilot after hardening and load testing.
- Do not build MQTT/TimescaleDB before pilot unless load testing proves the current stack cannot handle pilot load.
- For 500-600 vehicles, upgrade to broker/queue ingestion, Redis latest state, partitioned Postgres or TimescaleDB, and worker-based inference/alerts.

---

## 2. Backend Current State

### 2.1 Framework And App Surface

Implemented:

- FastAPI app in `production/backend/app/main.py`.
- API prefix from config: `/api/v1`.
- Registered routers:
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
  - `ws` without `/api/v1` prefix for WebSocket handshake compatibility

### 2.2 Auth And Authorization

Implemented:

- Supabase JWT validation with JWKS support for ES256 tokens.
- Legacy password auth supported only when `LEGACY_AUTH_ENABLED=true`.
- Production config refuses legacy auth when `ENVIRONMENT=production`.
- Backend workspace authorization remains separate from Supabase identity.
- User roles:
  - `trickee_admin`
  - `fleet_operator`
  - `driver`
- Admin access approval workflow:
  - `POST /api/v1/auth/access-request`
  - `GET /api/v1/admin/access-requests`
  - `POST /api/v1/admin/access-requests`
  - `POST /api/v1/admin/access-requests/{request_id}/approve`
  - `POST /api/v1/admin/access-requests/{request_id}/reject`
- Server-side scope checks for fleet, driver, vehicle, and role-sensitive endpoints.
- Security event table and admin approval audit events.

Production requirements still open:

- Confirm Render has correct `SUPABASE_URL`, `SUPABASE_JWKS_URL`, `SUPABASE_JWT_SECRET`, and `SUPABASE_JWT_AUDIENCE=authenticated`.
- Keep `LEGACY_AUTH_ENABLED=false` in production.
- Seed/approve production admin through Supabase Auth plus internal `users` role mapping.

### 2.3 Telemetry Ingestion

Implemented:

- Single ingest: `POST /api/v1/telemetry/evify`.
- Bulk ingest: `POST /api/v1/telemetry/evify/bulk`.
- Bulk cap: `MAX_BULK_TELEMETRY_ROWS = 500`.
- Single and bulk ingest require `trickee_admin` or `fleet_operator`.
- Per-user rate limiting is applied.
- Duplicate vehicle/timestamp rows are skipped by lookup before insert.
- Database-level duplicate protection now exists through migration `0011_telemetry_ingest_scale_guards.py` / revision `0011_ingest_scale` on `(vehicle_id, recorded_at)`.
- Ingest computes derived physics fields and updates trip/wait/alert foundations.
- Pilot debug logs are emitted for single and bulk ingest with request ID, user ID, row count, vehicle/driver counts, alert flag, rejection reason, and elapsed milliseconds.
- Oversized bulk batches log `telemetry_bulk_rejected` before returning `413`.
- Empty bulk batches return `400`.
- Bulk ingest commits once and publishes only the latest live-map point per vehicle after commit, not every row.
- Single-row ingest schedules live-map publish after commit without waiting on WebSocket fanout in the request path.

Important current gap for Evify Data 7.0:

- Evify Data 7.0 has `RegNo` and `VehicleId`, but no `driver_id`.
- Current `telemetry_ingest.py` creates a Driver only when `driver_code` exists.
- Current `trip_inference.py` returns early when `row.driver_id` is missing.
- Therefore, with Evify 7.0 as-is, telemetry can ingest as vehicle data, but driver profiles and trip inference will not fully populate unless we implement the pilot vehicle-proxy driver rule.

Required pilot fix:

```text
if Evify driver_id is missing:
  driver_code = RegNo or VehicleId
  profile_source = vehicle_proxy
```

This must be labeled as vehicle-attached behavior, not true human-driver identity.

### 2.4 Evify Adapter Readiness

Implemented:

- `evify_adapter.py` normalizes Evify JSON/Mongo-style payloads into canonical telemetry fields.
- Handles `RegNo`, `eventTime`, `Latitude`, `Longitude`, `Speed`, `IgnitionOn`, `soc`, `soH`, and several CAN aliases.
- Caps unusable current spikes by falling back between pack current and MCU DC current.

Important current gap for Evify Data 7.0:

- Evify 7.0 CAN keys include snake_case fields such as:
  - `current`
  - `battery_voltage`
  - `vehicle_speed`
  - `charge_plug_status`
  - `cell_temperature_01`
  - `maximum_temperature`
  - `bms_chargingcycles`
  - `cellvoltage_mismatch`
- Current adapter aliases do not fully cover all of these exact key names.
- Result: some Evify 7.0 fields may normalize to defaults even though the raw data has usable values.

Required pilot fix:

- Add Evify 7.0 aliases before load testing or replay:
  - `BatteryVoltage`, `battery_voltage`
  - `current`
  - `vehicle_speed`
  - `charge_plug_status`
  - `cell_temperature_01`, `maximum_temperature`
  - `bms_chargingcycles`
  - `cellvoltage_mismatch`
- Keep current spike guards.

### 2.5 Database And Migrations

Implemented migrations:

- `0001_initial.py`
- `0002_v5_v6_foundations.py`
- `0003_wait_events.py`
- `0004_firebase_auth_fcm.py`
- `0005_timeseries_pilot_indexes.py`
- `0006_archetype_history.py`
- `0007_supabase_schema_hardening.py`
- `0008_security_events_and_supabase_rls.py`
- `0009_ai_feature_logs.py`
- `0010_access_requests.py`
- `0011_telemetry_ingest_scale_guards.py` / revision `0011_ingest_scale`

Key tables/foundations:

- `fleets`
- `users`
- `access_requests`
- `device_push_tokens`
- `security_events`
- `vehicles`
- `drivers`
- `telemetry`
- `predictions`
- `trips`
- `driver_behavior_snapshots`
- `nudge_events`
- `order_assignment_decisions`
- `charging_decision_records`
- `wait_events`
- `alerts`
- `ai_interaction_logs`
- `tool_call_logs`
- `notification_personalization_logs`
- `assistant_messages`
- `driver_profile_snapshots`
- `driver_coaching_events`
- `fleet_summary_logs`

Pilot indexes already exist in migration `0005_timeseries_pilot_indexes.py`:

- `ix_telemetry_vehicle_recorded_at_desc`
- `ix_telemetry_driver_recorded_at_desc`
- `ix_telemetry_recorded_at_desc`
- `ix_telemetry_recorded_at_brin`
- `ux_telemetry_vehicle_recorded_at` from `0011_telemetry_ingest_scale_guards.py` / revision `0011_ingest_scale`

Production requirement:

- Run and verify `alembic upgrade head` on the deployed database.
- Cloud SQL target database was migrated from Supabase public schema and upgraded to `0011_ingest_scale` on 2026-05-22.
- Render still needs `DATABASE_URL` cutover to the Cloud SQL connection string before deployed traffic uses Cloud SQL.

Cloud SQL migration evidence - 2026-05-22:

| Check | Result |
|---|---|
| Cloud SQL DB | `trickee` |
| PostgreSQL version | 16.13 |
| Alembic current | `0011_ingest_scale` |
| `users` | 4 |
| `fleets` | 1 |
| `vehicles` | 7 |
| `drivers` | 9 |
| `trips` | 4 |
| `telemetry` | 98,982 deduplicated rows |
| Unique telemetry guard | `ux_telemetry_vehicle_recorded_at` present |

Migration note:

- Supabase had 100,492 telemetry rows but only 98,982 distinct `(vehicle_id, recorded_at)` pairs.
- Migration `0011_ingest_scale` intentionally removed duplicate vehicle/timestamp rows before enforcing the unique index.
- Supabase-only RLS policies were not restored on Cloud SQL; this is acceptable because Cloud SQL is backend-only and Supabase remains only the auth/session provider.

### 2.6 External Context

Implemented:

- `external_context.py` supports:
  - Google Places API (New) charger search with fallback chargers
  - Google Directions/traffic context with fallback travel time
  - Google Elevation with fallback
  - OpenWeather with fallback
- H3 spatial bucketing is implemented when `h3` is available.
- In-memory TTL caches exist.
- Optional Redis persistent cache exists when `REDIS_URL` is configured.
- Daily quota guards exist:
  - Google external daily limit
  - OpenWeather daily limit
- Config includes H3 resolution and weather H3 resolution.

Production requirements:

- Configure production API keys only on Render, not frontend.
- Verify cache hit rates under replay/load.
- Confirm external calls stay event-triggered, not per telemetry row.
- 2026-05-21 smoke test confirmed Directions and Elevation use Google sources, and charger lookup returns `google_places_new` after upgrading the backend call path from legacy Places nearby search to Places API (New).

### 2.7 WebSocket Live Map

Implemented:

- WebSocket endpoint: `/ws/live-map`.
- WebSocket ticket endpoint: `GET /api/v1/auth/ws-ticket`.
- Authenticated connection scopes by role/fleet/driver.
- Redis listener background task exists when `REDIS_URL` is configured.
- Frontend has WebSocket hook with reconnect and REST fallback.
- Single-row telemetry ingest now schedules live-map publish in the background after commit.
- Bulk telemetry ingest now publishes one latest live-map point per vehicle after commit, not one message per row.
- Redis latest live-state service exists in `app/services/live_state.py`.
- Live-map reads use Redis latest driver points first and fall back to Postgres latest rows when Redis is empty/unavailable.
- Live-state Redis keys are TTL-bound through `LIVE_STATE_TTL_SECONDS` and enabled through `LIVE_STATE_REDIS_ENABLED`.

Known risk:

- Need load test to confirm the scheduled publish path stays non-blocking with slow WebSocket clients.
- Redis should be enabled for pilot through `REDIS_URL` so live state, pub/sub, cache, and rate-limit paths are exercised before field testing.

Required pilot verification:

- Test single-row ingest with 10, 50, and 100 dashboard/WebSocket clients.
- Test bulk ingest with 50 concurrent 500-row batches and dashboards open.
- Confirm live-map point source reports Redis when live-state keys are warm and Postgres fallback when Redis is unavailable.

### 2.8 AI/LLM Infrastructure

Implemented:

- Shared LLM client: `production/backend/app/services/ai/llm_client.py`.
- Shared tool registry: `production/backend/app/services/ai/tool_registry.py`.
- Shared safety helpers: `production/backend/app/services/ai/safety.py`.
- Feature orchestration service: `production/backend/app/services/ai_features.py`.
- Provider: Groq OpenAI-compatible API.
- Default model from config: `GROQ_MODEL=llama-3.1-8b-instant`.
- Runtime env key: `GROQ_API_KEY`.
- Fallback behavior when `GROQ_API_KEY` is missing, timeout occurs, or provider call fails.
- Timeout, retry cap, max input chars, max output tokens in `app/config.py`.
- Safe logging through `ai_interaction_logs`.
- Tool call logging through `tool_call_logs`.
- Prompt instruction in the LLM client: use only provided facts; do not invent numbers, places, availability, traffic, SOC, range, or safety claims.

Current AI config defaults:

```text
GROQ_MODEL=llama-3.1-8b-instant
AI_REQUEST_TIMEOUT_SECONDS=4
AI_MAX_RETRIES=1
AI_MAX_INPUT_CHARS=4000
AI_MAX_OUTPUT_TOKENS=220
ASSISTANT_RATE_LIMIT_PER_HOUR=20
NOTIFICATION_PERSONALIZATION_RATE_LIMIT_PER_HOUR=10
CHARGER_RECOMMENDATION_RATE_LIMIT_PER_HOUR=30
ROUTE_EXPLANATION_RATE_LIMIT_PER_HOUR=30
FLEET_SUMMARY_RATE_LIMIT_PER_HOUR=20
COACHING_RATE_LIMIT_PER_DAY=10
```

Prompt/template status:

- There is currently no dedicated `prompt_templates/` or `prompts/` folder.
- Prompts do exist, but they are inline near the feature code that calls the LLM:
  - `production/backend/app/services/ai_features.py` for battery insight, charger recommendation, fleet summary, driver coaching, and assistant responses.
  - `production/backend/app/routers/notifications.py` for notification personalization.
  - `production/backend/app/routers/routes.py` for route explanation.
  - `production/backend/app/services/ai/llm_client.py` for the shared provider wrapper and `prompt_version = "v1"`.
- Reason: the first AI layer was built as a fast grounded-wrapper MVP. Each feature kept a small system instruction near its backend facts/tools instead of introducing a separate prompt module too early.
- This is acceptable for pilot because prompts are short guardrails and the backend computes/validates facts before the LLM sees them.
- This is not the ideal long-term structure. Before wider production, extract prompts into a centralized module such as:

```txt
production/backend/app/services/ai/prompts/
  notification_personalization.py
  route_explanation.py
  battery_insight.py
  charger_recommendation.py
  fleet_summary.py
  driver_coaching.py
  assistant.py
```

Each prompt module should define:

- `PROMPT_VERSION`
- system prompt
- user/facts prompt builder
- fallback text
- output constraints such as sentence count or JSON shape
- linked eval cases

Current tool registry:

- `get_driver_profile`
- `get_vehicle_state`
- `get_battery_prediction`
- `get_nearest_charger`
- `get_route_score`
- `get_trip_history`
- `get_fleet_status`
- `get_driver_baseline`
- `get_environment_context`
- `risk_analyzer`

Important architecture detail:

- These are not autonomous free-running agents.
- The backend chooses the intent, allowed tool calls, deterministic scores, thresholds, severity, and final action.
- The LLM only receives sanitized backend/tool facts and produces wording, explanation, summary, or conversational text.
- The LLM cannot directly call arbitrary APIs or pick its own tools.
- Tool calls enforce backend permission checks through `assert_driver_access` and `assert_vehicle_access`.
- Tool inputs and outputs are sanitized before logging.
- Sensitive keys such as password, token, access token, refresh token, secret, API key, phone, and email are removed from AI/tool logs.

Production constraints and boundaries:

- LLM never decides send/no-send, route ranking, charging ranking, dispatch, fleet risk, or driver score.
- LLM is only for wording, explanation, summary, and conversational response after backend facts/tools.
- Safety-critical assistant prompts bypass normal LLM advice and return escalation copy.
- Prompt-injection strings are detected in assistant messages and routed to a safe generic response.
- Charger availability is never invented; when real slot data is unavailable the output must say availability is not confirmed.
- If no tool succeeds for assistant response generation, the answer is `I can't check that right now.`

Feature routing:

| Feature | Endpoint / file | Backend facts/tools first | LLM role |
|---|---|---:|---|
| Notification personalization | `POST /api/v1/notifications/personalize`, `routers/notifications.py` | Yes | rewrite action into max 2-sentence driver message |
| Alert-triggered FCM personalization | `services/alert_service.py` | Yes | personalize push text before FCM send |
| Conversational assistant | `POST /api/v1/assistant/message`, `routers/assistant.py` + `ai_features.py` | Yes | compose answer from successful tools only |
| Route explanation | `POST /api/v1/routes/explain`, `routers/routes.py` | Yes | explain the route scorer result without changing ranking |
| Battery insight | `POST /api/v1/battery/insight`, `routers/battery.py` + `ai_features.py` | Yes | explain range/drain using prediction and baseline facts |
| Charger recommendation | `POST /api/v1/chargers/recommend`, `routers/chargers.py` + `ai_features.py` | Yes | explain deterministic charger ranking |
| Fleet summary | `POST /api/v1/fleet/summary`, `routers/fleet.py` + `ai_features.py` | Yes | summarize backend-computed risks/actions |
| Driver coaching | `POST /api/v1/drivers/{driver_id}/coaching`, `routers/drivers.py` + `ai_features.py` | Yes | write encouraging coaching from real metrics |

Current limitations / risks:

- Current provider is Groq only; there is no multi-provider failover yet.
- AI calls are synchronous inside request/alert flows; heavy/daily summarization should eventually move to background workers.
- Prompt-injection detection is basic pattern matching, not a full classifier.
- Tool registry defines allowed tool names and auth checks, but does not yet expose full JSON schemas per tool.
- Cost tracking records token usage when provider returns usage, but no hard monthly budget enforcement exists yet.
- Tool outputs depend on telemetry/profile quality; Evify 7.0 vehicle-proxy driver fix is still needed for reliable driver-grounded personalization.

---

## 3. Frontend Current State

Implemented Next.js app routes:

- `/`
- `/login`
- `/signup`
- `/admin`
- `/ai`
- `/alerts`
- `/data-quality`
- `/decisions`
- `/driver`
- `/fleet`
- `/impact`
- `/map`
- `/model-drift`
- `/observability`
- `/reports`
- `/routes`
- `/schedule`
- `/scorecards`
- `/vehicle`
- `/vehicle/[id]`

Implemented frontend foundations:

- Supabase session token retrieval.
- Legacy token fallback only when configured.
- Request timeout handling.
- GET caching/stale-while-revalidate for selected API calls.
- Role-based route/sidebar access.
- Dashboard shell is mobile-responsive for pilot browser use: desktop keeps the left sidebar, mobile uses a bottom scrollable nav with role-filtered links.
- Premium public landing page.
- Auth pages and access-request flow.
- Admin workspace approval UI.
- FCM token registration helper.
- AI workspace for assistant/notification/route/battery/charger/fleet/coaching flows.
- Dashboard pages for live map, fleet, decisions, routes, reports, scorecards, alerts, impact, data quality, observability, and model health.
- Fleet carousel now shows a center-highlighted, side-faded vehicle carousel without duplicated vehicle-card stack below it.
- Daily Impact now supports selecting a driver and viewing a detailed driver panel with value, time, orders, top-ups, actions, telemetry count, confidence, and proportional bars.
- Driver trip history now supports click-to-view trip route reconstruction via `GET /api/v1/drivers/{driver_id}/trips/{trip_id}/trace`.
- Data Quality now separates feed tags from issue text and checks GPS validity, battery validity, thermal validity, stale feed age, and current spikes.
- Live Map charger list shows all charger points returned by backend and explains that chargers are ranked from current visible driver/fleet GPS context.
- Live Map now supports mobile browser geolocation permission through a user-triggered "Use my location" action and displays the current browser location marker on the map.
- Frontend `Permissions-Policy` now allows same-origin geolocation for the dashboard instead of blocking it globally.

Role route status:

- `trickee_admin`: full operational/admin access.
- `fleet_operator`: fleet, vehicle, map, assistant, decisions, routes, schedule, impact, scorecards, reports, alerts, data quality.
- `driver`: driver profile, map, assistant, route intel, schedule, impact, alerts.

Admin profile correction:

- `/driver` and "My Profile" are driver-only now. Admins should use fleet, impact, scorecards, reports, observability, model health, and admin pages instead of seeing a driver profile as their own profile.

---

## 4. Feature Status Against Latest PRD

| # | Feature | Current status | What is real now | Remaining / limitation |
|---|---|---|---|---|
| 1 | LLM-personalized push notifications | Built, live receipt still needs deployed verification | `POST /api/v1/notifications/personalize`, alert-to-FCM personalization wiring, FCM token store, foreground/background browser push handlers, `POST /api/v1/alerts/test-push` | FCM production receipt on Vercel still needs live browser verification; WhatsApp not implemented |
| 2 | Conversational EV Assistant | Initial backend + UI built | `POST /api/v1/assistant/message`, intent classifier, tool registry, safety-critical fallback | Destination/order questions need user input or order feed; WhatsApp delivery not built |
| 3 | Route Reasoning Agent | Built | `POST /api/v1/routes/explain`, route scorer wrapper, tool-grounded explanation | Needs real route/traffic calibration in production |
| 4 | Battery Insight Agent | Built | `POST /api/v1/battery/insight`, baseline/prediction/environment-aware fallback | Accuracy depends on clean telemetry and populated profiles |
| 5 | Charging Recommendation Agent | Built with deterministic ranking | `POST /api/v1/chargers/recommend`, Google/fallback charger context, "availability not confirmed" guard | Real slot availability requires Bolt/Pulse/UBC or partner API |
| 6 | Driver Profile Memory | Partially built | `GET/POST /api/v1/drivers/{id}/profile`, snapshots, rolling metrics, archetype logic | Evify 7.0 needs vehicle-proxy driver creation before live profiles populate |
| 7 | Fleet Monitoring Agent | Built foundation | `POST /api/v1/fleet/summary`, fleet live overview, LLM summary with backend facts | Daily email/WhatsApp summary delivery not built |
| 8 | Driver Coaching Agent | Built foundation | `POST /api/v1/drivers/{id}/coaching`, metrics, coaching events | Needs better trip/session metrics and true driver identity for production-grade coaching |
| 9 | Smart Order Assignment | Backend built | `POST /api/v1/intelligence/orders/assign`, persistence/history | Needs real order feed and frontend operator workflow validation |
| 10 | True Wait Time Model | Backend built | `POST /api/v1/intelligence/wait-time`, travel/prep/buffer calculation | Needs restaurant location, prep time, order assignment timestamp |
| 11 | 3-Option Charging Decision | Backend built | `POST /api/v1/intelligence/charging/decision`, records/history | Needs real order feed and real charger availability for production claims |
| 12 | V5-A Driver Behavioral Model | Training foundation built | `app/ml/v5a_training.py`, 24-feature list, SOC-quality filtering | Not promoted to production inference; Evify 7.0 needs adapter/proxy fixes first |
| 13 | External APIs | Built foundation | Weather/elevation/directions/places service with H3/cache/quota/fallback; map charger points are ranked from current live driver/fleet GPS context and capped to relevant returned points | Needs production keys, quota monitoring, and real charger inventory/slot provider for full-city availability claims |
| 14 | Personalized Departure Nudge | Partial | route scoring and personal_factor foundations exist | No full ignition-triggered FCM/WhatsApp pipeline yet |
| 15 | Opportunistic Charging Alert | Partial | alert service, wait classifier, charger lookup, stop/SOC foundations | Needs context-aware stop engine and push verification |
| 16 | Trip Digital Twin | Partial | `trips` table, GPS trip inference, and click-to-view trip trace endpoint/UI exist | Current trip inference requires `driver_id`; vehicle-proxy trip generation must be implemented before Evify 7.0 fully populates trips |
| 17 | Driver Scorecard & Fleet Intelligence | Partial | `/scorecards`, fleet live, driver behavior history | Formula is basic; needs trip-twin and profile confidence improvements |
| 18 | RL Nudge Optimizer | Future | `nudge_events` outcome fields exist | Needs months of A/B outcome data |
| 19 | V6 Driver Embedding Model | Future | Tables and outcome data path exist | Needs stable driver IDs and 3+ months/500+ trips per driver |
| 20 | Real-Time Streaming Architecture | Future scale path | Current pilot indexes and bulk ingest exist | Build after pilot success or load-test failure |
| 21 | Driver Archetype Classifier | Built | live driver profile archetype output and snapshot fields | Needs vehicle-proxy driver support for Evify 7.0 |
| 22 | Platform Integrations | Not built | Docs only | Swiggy/Zomato/Twilio/Bolt/Pulse/UBC access required |
| 23 | ETA Personalization | Built foundation | personal_factor update from trip outcome | Needs trip inference to populate reliably with proxy driver |
| 24 | Agent vs Backend Framework | Implemented in design | deterministic backend decisions + LLM wording/explanation only | Continue enforcing tool boundary |
| 25 | Pitch Demo Requirements | Partially supported | landing page, map, decisions, routes, reports, AI workspace | Demo recordings and FCM verification still needed |
| 26 | Context Signal Intelligence | Partial | ignition, speed, GPS, SOC, weather/traffic/elevation, H3 cache, wait classifier | Need persistent H3/area intelligence and stop reason confidence |

---

## 5. Evify Data 7.0 Readiness

Observed dataset:

- 48 JSON files.
- 90,833 telemetry rows.
- `RegNo` present.
- `VehicleId` present.
- `Latitude` and `Longitude` present.
- `eventTime` and `DateTimeOfLog` present.
- `soc` and `soH` mostly present.
- `Speed` and `IgnitionOn` present.
- CAN data includes current, voltage, regen, throttle, temperature, capacity, DTE, and charge-plug status.
- `charge_plug_status` is present but all observed values are `0`.

Missing from Evify 7.0:

- no real `driver_id`
- no `trip_id`
- no planned destination
- no order ID
- no restaurant/customer destination
- no prep time
- no charger slot availability

What Evify 7.0 can support now:

- pilot load testing
- vehicle-level live fleet monitoring
- vehicle-proxy behavior profiles after code fix
- generated trip/session IDs after code fix
- GPS trip reconstruction
- stop/wait window analysis
- battery drain baseline analysis
- H3 area clustering
- context-aware opportunistic charging
- scorecards/coaching using vehicle proxy

What Evify 7.0 cannot honestly support alone:

- true human-driver personalization
- full food-order assignment intelligence
- true restaurant wait-time intelligence
- customer destination planning
- real charger slot availability
- V6 driver embeddings
- RL nudge optimization

---

## 6. Pilot Intelligence Decision

### Trip IDs

Evify does not need to provide `trip_id`.

Trickee should generate trip/session IDs:

```text
trip starts = ignition ON + speed above movement threshold + valid GPS
trip continues = same vehicle session while moving or briefly stopped
trip ends = ignition OFF or stopped beyond configured timeout
trip_id = vehicle_or_regno + start_timestamp + short hash/sequence
```

Current code status:

- `trips.id` exists and defaults to UUID.
- `trip_inference.py` creates trip rows from ignition/speed/GPS.
- Gap: it currently requires `row.driver_id`; Evify 7.0 does not provide one.

Required pilot implementation:

- create/use vehicle-proxy driver when no real driver ID exists
- persist `trip_source = gps_inferred` or equivalent metadata later if schema is expanded
- preserve migration path to real driver IDs

### Driver Profiles

Pilot decision:

- Use `RegNo` or `VehicleId` as temporary profile key when no real driver ID exists.
- Label it as vehicle-attached behavior.
- Do not claim it is a true driver identity.

Production target:

```text
vehicle_behavior_profile
  -> driver_behavior_profile after Evify provides driver mapping
```

### Opportunistic Wait/Charging Intelligence

Use this product name for pilot:

```text
Context-aware opportunistic charging intelligence
```

Do not call it full order wait-time intelligence unless order feed data exists.

Inputs available now:

- ignition status
- ignition ON/OFF duration
- speed near zero
- SOC and SOC trend
- GPS stop location
- area/H3 zone
- nearby chargers
- traffic/road context
- historical stop pattern

Stop classification target:

```text
charging_wait
restaurant_or_pickup_wait
traffic_wait
crossroad_or_signal_wait
idle_wait
depot_wait
unknown_stop
```

Recommendation rule:

- recommend charging only when stop confidence and charging value are high
- do not recommend charging for short traffic/crossroad/signal stops
- do not invent restaurant/order wait time without order context
- always mark charger slot availability as unconfirmed unless a real slot API is connected

---

## 7. Current API Surface

Core:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/firebase-login`
- `POST /api/v1/auth/access-request`
- `GET /api/v1/auth/me`
- `GET /api/v1/auth/ws-ticket`
- `POST /api/v1/auth/fcm-token`
- `DELETE /api/v1/auth/fcm-token`
- `POST /api/v1/auth/logout`

Telemetry:

- `POST /api/v1/telemetry/evify`
- `POST /api/v1/telemetry/evify/bulk`

Vehicles and drivers:

- `GET /api/v1/vehicles`
- `GET /api/v1/vehicles/me`
- `GET /api/v1/vehicles/{vehicle_id}`
- `GET /api/v1/vehicles/{vehicle_id}/telemetry`
- `GET /api/v1/drivers`
- `GET /api/v1/drivers/me`
- `GET /api/v1/drivers/{driver_id}`
- `GET /api/v1/drivers/{driver_id}/trips`
- `GET /api/v1/drivers/{driver_id}/profile`
- `POST /api/v1/drivers/{driver_id}/profile/update`
- `POST /api/v1/drivers/{driver_id}/coaching`

Prediction and routes:

- `POST /api/v1/predictions/infer/{vehicle_id}`
- `GET /api/v1/predictions/{vehicle_id}/history`
- `POST /api/v1/routes/score`
- `POST /api/v1/routes/reroute`
- `POST /api/v1/routes/explain`

Intelligence:

- `GET /api/v1/intelligence/drivers/{driver_id}/behavior`
- `GET /api/v1/intelligence/drivers/{driver_id}/live-profile`
- `GET /api/v1/intelligence/drivers/{driver_id}/live-decision`
- `POST /api/v1/intelligence/drivers/{driver_id}/live-decision`
- `GET /api/v1/intelligence/fleet/live`
- `GET /api/v1/intelligence/live-map`
- `GET /api/v1/intelligence/reports/weekly`
- `GET /api/v1/intelligence/reports/charts`
- `GET /api/v1/intelligence/reports/daily-impact`
- `POST /api/v1/intelligence/context`
- `POST /api/v1/intelligence/wait-time`
- `POST /api/v1/intelligence/orders/assign`
- `POST /api/v1/intelligence/charging/decision`
- `GET /api/v1/intelligence/history/driver-behavior`
- `GET /api/v1/intelligence/history/nudges`
- `GET /api/v1/intelligence/history/order-assignments`
- `GET /api/v1/intelligence/history/charging-decisions`
- `GET /api/v1/intelligence/history/waits`

AI features:

- `POST /api/v1/notifications/personalize`
- `POST /api/v1/assistant/message`
- `POST /api/v1/battery/insight`
- `POST /api/v1/chargers/recommend`
- `POST /api/v1/fleet/summary`

Admin and ops:

- `GET /api/v1/admin/metrics`
- `GET /api/v1/admin/users`
- `GET /api/v1/admin/fleets`
- `GET /api/v1/admin/drivers`
- `GET /api/v1/admin/access-requests`
- `POST /api/v1/admin/access-requests`
- `POST /api/v1/admin/access-requests/{request_id}/approve`
- `POST /api/v1/admin/access-requests/{request_id}/reject`
- `GET /api/v1/alerts`
- `POST /api/v1/alerts/{alert_id}/resolve`
- `/ws/live-map`

---

## 8. Production/Pilot Hardening Still Required

P0 before pilot:

1. Run `alembic upgrade head` in production and verify revision `0011_ingest_scale`.
2. Add Evify 7.0 aliases to `evify_adapter.py`.
3. Implement vehicle-proxy driver creation from `RegNo` or `VehicleId` when no real driver ID exists.
4. Confirm generated trip/session IDs populate under Evify 7.0 replay.
5. Load test `/api/v1/telemetry/evify/bulk`:
   - 500 rows accepted
   - 501 rows rejected with 413
   - 50 concurrent 500-row batches tested
   - use `production/backend/scripts/replay_evify_bulk.py` to replay `Evify data 7.0` into the real bulk endpoint
   - temporarily raise `TELEMETRY_RATE_LIMIT_PER_MINUTE` in staging for capacity testing, or expected HTTP 429 responses will hide DB/API capacity
6. Confirm scheduled WebSocket fanout does not block ingest under dashboard load.
7. Configure/verify `REDIS_URL`, `LIVE_STATE_REDIS_ENABLED=true`, and `LIVE_STATE_TTL_SECONDS=300` for Redis live state, rate limits, cache, and pub/sub in pilot.
8. Verify external API cache/quota behavior under replay.
9. Verify FCM production push receipt on deployed Vercel URL.
10. Keep WhatsApp soft-locked until opt-in, templates, provider, and abuse limits are implemented.

P1 before wider pilot:

1. Persist or compute H3/area clusters for recurring stop zones.
2. Add context-aware stop classifier for traffic/crossroad/signal vs useful wait.
3. Add dashboard labeling that distinguishes vehicle-proxy profile from real driver profile.
4. Expand replay/load-test coverage using Evify Data 7.0.
5. Add telemetry adapter regression tests for Evify 7.0 payload keys.
6. Add performance checks for latest-vehicle/latest-driver queries.
7. Add data-quality dashboard cards for SOC jumps, missing driver IDs, missing charge plug, and GPS gaps.

Latest local test pass - 2026-05-22:

- Backend unit/eval suite: 48 tests passed.
- Focused WebSocket manager scale test - 2026-05-22: 2 tests passed.
- Frontend lint: passed.
- Frontend production build: passed.
- Latest Alembic migration in code: `0011_ingest_scale`.
- Previous configured DB state before new scale migration: `0010_access_requests (head)`.
- Render `/health`: 200 OK, V4.1 model ready.
- Google external context smoke:
  - Directions: `google_directions`
  - Elevation: `google_elevation`
  - Chargers: `google_places_new`
- Source/docs secret-pattern scan excluding env files found no concrete exposed Google/API secret values.
- Pilot CI workflow added at `.github/workflows/pilot-ci.yml` for backend compile/tests/Alembic head sanity, frontend lint/build, and tracked env/service-account blocking. This is a CI gate only; production Render/Vercel deployments still require post-deploy smoke verification.

Open dependency findings:

- Frontend dependency audit still flags `next@14.2.35`; npm's available automated fix is a breaking Next 16 migration.
- Backend dependency audit flags `python-jose`, `python-multipart`, `starlette`, `torch`, `joblib`, `pytest`, and transitive `pyjwt`.
- Handle these in a dependency-hardening branch with compatibility testing rather than force-upgrading on the pilot branch.

---

## 9. Notification Layer

Current implemented notification surfaces:

- Dashboard alerts feed.
- Alert persistence in `alerts`.
- Nudge events in `nudge_events`.
- FCM token registration endpoints and `device_push_tokens`.
- Firebase FCM service exists behind config.
- LLM notification personalization endpoint exists.
- Alert-triggered FCM now calls the grounded personalization layer before sending.
- Browser foreground FCM messages now surface via the Notification API.
- Background FCM is served by `/firebase-messaging-sw.js` with click-through to `/alerts` or `/fleet`.
- `POST /api/v1/alerts/test-push` sends a test push to the current user's active browser tokens and records an FCM nudge event.

Not yet verified/implemented:

- End-to-end FCM receipt on deployed Vercel URL.
- Firebase browser permission and token registration must be confirmed in the deployed browser session.
- WhatsApp sending.
- WhatsApp opt-in management.
- WhatsApp template approval.
- WhatsApp cost/rate monitoring.

Recommended production shape:

```text
Backend alert/decision engine
  -> dashboard alert/feed
  -> FCM/browser push after deployed verification
  -> WhatsApp fallback/high-priority channel after opt-in and templates
```

---

## 10. Model And Data Quality Status

Current production inference:

- V4.1 model path in config:
  - `battery_model_v4_1.pth`
  - `scaler_v4_1.joblib`
  - `y_scaler_v4_1.joblib`
- AI engine uses latest telemetry window and SOC-quality guard.
- Inference is on demand, not per telemetry row.

V5-A status:

- Training script exists in `app/ml/v5a_training.py`.
- 24 features are defined: 20 physics + 4 behavior features.
- SOC delta quality filtering exists.
- V5-A is not promoted as the production inference model.

Evify Data 7.0 model implication:

- Data can support vehicle-proxy behavioral training after adapter/proxy fixes.
- It cannot support true per-human driver embeddings without driver mapping.
- Impossible SOC jumps must stay filtered from training/evaluation and charging detection.

---

## 11. What Is Safe To Demo

Safe if environment and data are loaded:

- public landing page
- workspace auth flow
- admin access approval
- fleet dashboard
- vehicle forecast page
- live map with REST/WebSocket fallback
- alerts feed
- route scoring and route explanation
- decisions page using controlled order/wait/charging inputs
- daily impact report
- reports/charts
- AI workspace demos with fallback-safe LLM
- battery insight
- charger recommendation with "availability not confirmed"
- fleet summary
- driver coaching from available telemetry

Must be framed carefully:

- driver profile is vehicle-proxy if real driver ID is missing
- trip ID is Trickee-inferred, not Evify-provided
- opportunistic charging is context-aware, not guaranteed order wait-time
- charger slot availability is unconfirmed unless real slot API is integrated
- order assignment and 3-option charging are backend-capable but need live order data for real production value

Do not claim as live production:

- full food-platform order intelligence
- real-time charger slot availability
- WhatsApp delivery
- RL nudge optimization
- V6 driver embeddings
- MQTT/Timescale streaming architecture

---

## 12. Final Pilot Position

Current codebase is strong enough to proceed toward a 50-100 vehicle pilot **after** the adapter/proxy/load-test hardening items are completed.

The most important blockers are not the AI features. They are:

1. Evify 7.0 adapter alias completeness.
2. Vehicle-proxy driver creation for missing `driver_id`.
3. Trickee-generated trip/session inference working under real replay.
4. Bulk ingest concurrency test.
5. WebSocket fanout load test.
6. FCM deployed verification.

After these are fixed and verified, Trickee can honestly pilot:

```text
vehicle-level EV intelligence
GPS trip reconstruction
context-aware charging opportunities
battery/range insights
fleet monitoring
driver/vehicle behavior profiles
fallback-safe AI explanations
```

The following remain post-pilot or integration-dependent:

```text
true driver identity
order-aware wait-time intelligence
live charger slot availability
WhatsApp delivery
V6 embeddings
RL nudge optimizer
MQTT/Timescale streaming stack
```

---

## 13. Future Backlog Summary

A long cross-source audit was moved to `future_backlog_cross_source_audit.md` so this file remains focused on current implementation status and pilot readiness.

Important backlog themes captured there:

- Android-first rider app for fleets without direct Evify telemetry API access.
- PostGIS geometry columns and persistent H3 cells for spatial intelligence.
- H3 aggregation tables for pickup/wait clusters, low-SOC hotspots, and charging opportunity zones.
- Formal probabilistic operational-state FSM beyond the current rule-based `wait_classifier.py`.
- Background worker infrastructure for heavy inference, aggregation, reports, notifications, and data-quality jobs.
- Real-time frontend charts with time-range filters and no static graph images.
- Completed PWA/offline/install/push-notification experience.
- Persistent range/SOC/risk badge across driver and fleet views.
- Past trip playback on map with GPS polyline, stops, SOC, and events.
- Driver rewards, incentive tiers, and fairness normalization.
- Profit/delivery-count impact estimates per driver.
- Confidence-scored opportunistic charging pipeline.
- Seven-day departure schedule and route plan.
- Learned restaurant wait-time intelligence from stop/H3 patterns.
- Harsh acceleration, braking, jerk, and missed-regen event detection.
- Peak-hour, holiday, and occasion-aware intelligence.
- Pitch/demo asset production requirements.
- Pricing tiers, feature soft-locks, and entitlement gating.
- Formal ABAC beyond current role/fleet/driver filters.
- Abzo/multi-fleet white-label support.
- AI/model eval tables and model-drift tracking.
- Swiggy, Zomato, Google Maps MCP, Twilio, Bolt.Earth, Pulse Energy, and UBC integrations.
- Wait/order/charging frontend workflow completion.
- ChargePlugStatus verification and CAN current artifact monitoring.
- Destination/place-intent confidence architecture.

Current interpretation:

- These are future or pilot-plus backlog items unless Section 2-12 above marks them as already implemented.
- They must not be represented as shipped functionality in pitch/demo material.
- Pilot-critical items from this backlog are already promoted into Section 8: Evify 7.0 adapter aliases, vehicle-proxy driver creation, generated trip/session inference, bulk ingest load testing, WebSocket fanout testing, and FCM deployed verification.
