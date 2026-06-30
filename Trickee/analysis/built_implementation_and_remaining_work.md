# Trickee Implementation Status And Remaining Work
**Last reconciled:** 2026-06-02
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
- New OAuth/password signups create a pending workspace access request; the requested role is treated as user intent only, not authorization.
- Unknown Supabase OAuth sessions default to a pending `driver` request unless the signup flow stored a selected role before OAuth redirect.
- 2026-05-25 auth flow update:
  - Email/password signup captures full name, company/fleet, and requested role.
  - Google OAuth signup also captures company/fleet and requested role before redirect, then writes the pending access request after Supabase returns the session.
  - Pending users are not allowed into the dashboard until backend workspace approval succeeds.
  - Login now shows a clear admin-approval dialog for pending accounts instead of a vague workspace-access error.
- 2026-05-26 auth flow update:
  - Signup now exposes active vehicle numbers as a driver-only vehicle hint for both email/password and Google OAuth.
  - Access requests persist `requested_vehicle_id` through migration `0012_access_request_vehicle_hint`.
  - Admin approval can verify or change the requested vehicle number before mapping the account to the final driver profile.
  - Admins can now edit already-approved user mappings after approval: role, fleet/team, driver profile, display name, and active status.
  - Approved-user remapping is server-validated and audited through `admin_user_mapping_updated` security events.
- User roles:
  - `trickee_admin`
  - `fleet_operator`
  - `driver`
- Admin access approval workflow:
  - `POST /api/v1/auth/access-request`
  - `GET /api/v1/admin/access-requests`
  - `POST /api/v1/admin/access-requests`
  - `PATCH /api/v1/admin/users/{user_id}/mapping`
  - `POST /api/v1/admin/access-requests/{request_id}/approve`
  - `POST /api/v1/admin/access-requests/{request_id}/reject`
- Server-side scope checks for fleet, driver, vehicle, and role-sensitive endpoints.
- Security event table and admin approval audit events.
- Admin approval is the path that activates a workspace user role; after approval, admins can still correct user role/team/driver mapping from the admin console.
- Driver account approval requires admin mapping from the login identity to an existing telemetry driver profile.
- Current mapping is semi-manual because Evify telemetry does not provide a guaranteed email/phone/employee/order-partner identity that can prove which Gmail belongs to which driver. The selected vehicle number is a hint, not proof.

Production requirements still open:

- Confirm Render has correct `SUPABASE_URL`, `SUPABASE_JWKS_URL`, `SUPABASE_JWT_SECRET`, and `SUPABASE_JWT_AUDIENCE=authenticated`.
- Keep `LEGACY_AUTH_ENABLED=false` in production.
- Seed/approve production admin through Supabase Auth plus internal `users` role mapping.
- For clean driver onboarding, add an invite-code or QR onboarding flow where an admin creates an invite against a specific existing driver profile and the driver signs up through that link. This makes driver-profile mapping deterministic instead of relying on manual Gmail-to-driver matching.

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

Evify 7.0 vehicle-proxy driver support:

```text
if Evify driver_id is missing:
  driver_code = RegNo or VehicleId
  profile_source = vehicle_proxy
```

- Implemented in `telemetry_ingest.py`.
- Missing Evify driver IDs now create/use a proxy `Driver` based on `RegNo` or `VehicleId`.
- Proxy driver display name uses `Vehicle Profile <vehicle_code>`.
- Trip inference now works for these vehicle-proxy drivers.
- This is still vehicle-attached behavior, not a true human-driver identity.
- Regression tests cover single-row and bulk Evify 7.0 ingest with proxy driver/trip creation.

### 2.4 Evify Adapter Readiness

Implemented:

- `evify_adapter.py` normalizes Evify JSON/Mongo-style payloads into canonical telemetry fields.
- Handles `RegNo`, `eventTime`, `Latitude`, `Longitude`, `Speed`, `IgnitionOn`, `soc`, `soH`, and several CAN aliases.
- Caps unusable current spikes by falling back between pack current and MCU DC current.

Evify 7.0 aliases now covered:

- `BatteryPercentage`
- `BatteryVoltage`, `battery_voltage`
- `current`
- `vehicle_speed`
- `charge_plug_status`
- `cell_temperature_*`, `maximum_temperature`, `MCUTemperature`
- `bms_chargingcycles`
- `cellvoltage_mismatch`
- `throughput`
- `DateTimeOfLog`
- `VehicleId`

Regression coverage:

- `test_evify_7_adapter_aliases_are_normalized`
- `test_evify_7_ingest_creates_vehicle_proxy_driver_and_trip`
- `test_evify_7_bulk_ingest_creates_vehicle_proxy_driver_and_trip`

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
- `0012_access_request_vehicle_hint.py` / revision `0012_access_request_vehicle_hint`

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

- Run and verify `alembic upgrade head` on the deployed database before every pilot deployment.
- Cloud SQL target database was migrated from Supabase public schema and upgraded to `0011_ingest_scale` on 2026-05-22.
- 2026-05-27 verification: configured Postgres/Cloud SQL database is at `0012_access_request_vehicle_hint (head)`.
- Render still needs `DATABASE_URL` cutover to the Cloud SQL connection string before deployed traffic uses Cloud SQL.

Cloud SQL migration evidence - 2026-05-22:

| Check | Result |
|---|---|
| Cloud SQL DB | `trickee` |
| PostgreSQL version | 16.13 |
| Alembic current | `0012_access_request_vehicle_hint` after 2026-05-27 upgrade |
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
- Operator confirmed `REDIS_URL` is set in Render. Local `.env` does not contain Redis, and this session does not have Render CLI/MCP access, so deployed Redis runtime proof still needs Render log/API verification without exposing the secret.
- `/health` now reports boolean `redis_configured` and `live_state_redis_enabled` flags so deployed verification can confirm Redis wiring without exposing the Redis URL.

Required pilot verification:

- Test single-row ingest with 10, 50, and 100 dashboard/WebSocket clients.
- Test bulk ingest with 50 concurrent 500-row batches and dashboards open.
- Confirm live-map point source reports Redis when live-state keys are warm and Postgres fallback when Redis is unavailable.

### 2.8 Evify 7.0 Replay And Load Evidence

Verified on 2026-05-27 against the configured Postgres/Cloud SQL target:

| Check | Result |
|---|---|
| `alembic upgrade head` | completed |
| `alembic current` | `0012_access_request_vehicle_hint (head)` |
| Backend compile | passed |
| Backend tests | `51 passed` |
| Focused Evify 7.0 regression tests | `3 passed` |
| CORS PATCH support | implemented in `app/main.py` |
| 500-row Evify 7.0 bulk replay | inserted 500 rows successfully |
| Latest bounded replay throughput | 500 rows in 6.06s ingest time, about 82.55 rows/sec |
| Full Evify 7.0 replay | completed 205 batches / 90,833 raw rows |
| Full replay inserted delta | 88,833 new telemetry rows after prior bounded test inserts |
| Full replay elapsed | 1,170.25s, about 77.62 raw rows/sec |
| Evify 7.0 DB coverage after replay | 90,833 / 90,833 distinct Evify 7.0 keys present |
| Vehicle-proxy drivers after replay | 48 |
| Trip inference after replay | total trips increased to 7,066 |
| Deployed Redis health flags | `/health` shows `redis_configured=true`, `live_state_redis_enabled=true` |

Replay implementation detail:

- Bulk ingest is DB-bound for historical replay.
- Bulk trip inference does not call external Google ETA/personal-factor updates.
- Live single-row trip closure can still update `personal_factor`; historical replay avoids that external fan-out.
- Deployed Redis env wiring is verified through safe `/health` booleans. Actual Redis read/write proof still requires authenticated telemetry ingest followed by live-map source verification, or a local Redis roundtrip with `REDIS_URL` set in the shell.

### 2.9 AI/LLM Infrastructure

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
- Tool outputs depend on telemetry/profile quality; Evify 7.0 vehicle-proxy drivers now unblock vehicle-grounded personalization, but true human-driver identity still requires Evify-provided mapping or admin invite/QR onboarding.

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
- Auth pages and access-request flow. Signup supports both email/password and Google OAuth with a requested role selector.
- Driver signup includes a vehicle-number dropdown; admins can verify or override that vehicle hint during approval.
- Pending users are returned to login with a clear admin-approval dialog instead of seeing a vague workspace error.
- Admin workspace approval UI shows the requested role, allows final role override, and requires explicit driver-profile mapping only when approving a Driver account.
- Admin user management now allows correcting approved users after the fact, including role, team, driver profile, display name, and active/inactive status.
- FCM token registration helper.
- AI workspace for assistant/notification/route/battery/charger/fleet/coaching flows.
- Dashboard pages for live map, fleet, decisions, routes, reports, scorecards, alerts, impact, data quality, observability, and model health.
- Fleet carousel now shows a center-highlighted, side-faded vehicle carousel without duplicated vehicle-card stack below it.
- Daily Impact now supports selecting a driver and viewing a detailed driver panel with value, time, orders, top-ups, actions, telemetry count, confidence, and proportional bars.
- Driver trip history now supports click-to-view trip route reconstruction via `GET /api/v1/drivers/{driver_id}/trips/{trip_id}/trace`, plus a large trip-detail view with route path, source/destination, SOC, energy, speed, duration, route/nudge metrics, estimated trip energy cost, estimated cost per km, estimated savings, and future placeholders for order-linked wait/charging savings.
- Dedicated `/trips` page now exists for driver, fleet operator, and admin roles. It exposes past trips as a first-class navigation item instead of burying trip replay only inside the driver profile page.
- Data Quality now separates feed tags from issue text and checks GPS validity, battery validity, thermal validity, stale feed age, and current spikes.
- Live Map charger list shows all charger points returned by backend and explains that chargers are ranked from current visible driver/fleet GPS context.
- Route Intel and 7-Day Schedule no longer rely only on the original five demo places:
  - Map picker presets were expanded across more Surat pilot zones.
  - Route Intel and Schedule auto-seed origin from the selected vehicle's latest GPS when available.
  - 7-Day Schedule rotates pilot destinations by day while the default destination is unchanged; if the user chooses a custom destination, it uses that selected destination for all days.
- Driver mobile browser readiness is now implemented for pilot use:
  - Driver profile page prompts for geolocation on entry and keeps a `watchPosition` active while the page remains open.
  - Live Map auto-prompts driver accounts for location and keeps the current browser location marker updated while the map remains open.
  - Driver-accessible pages now have tighter mobile spacing, safe-area bottom navigation, full-width mobile controls, and mobile-safe alert cards.
  - FCM notification click-through now lands on `/alerts` by default, which is valid for driver accounts.
  - The app shell cache includes driver routes (`/driver`, `/map`, `/alerts`, `/ai`) for a better PWA browser experience.
- Browser limitation: mobile Chrome can receive background push through service worker/FCM after permission and token registration, but reliable always-on background GPS tracking is not guaranteed in a browser. Continuous ride GPS is active while the driver page/map is open; native Android/PWA platform behavior is required for stronger background tracking.
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
| 6 | Driver Profile Memory | Partially built | `GET/POST /api/v1/drivers/{id}/profile`, snapshots, rolling metrics, archetype logic, vehicle-proxy profiles for Evify 7.0 | True human-driver identity still requires Evify mapping/invite flow |
| 7 | Fleet Monitoring Agent | Built foundation | `POST /api/v1/fleet/summary`, fleet live overview, LLM summary with backend facts | Daily email/WhatsApp summary delivery not built |
| 8 | Driver Coaching Agent | Built foundation | `POST /api/v1/drivers/{id}/coaching`, metrics, coaching events | Needs better trip/session metrics and true driver identity for production-grade coaching |
| 9 | Smart Order Assignment | Backend built | `POST /api/v1/intelligence/orders/assign`, persistence/history | Needs real order feed and frontend operator workflow validation |
| 10 | True Wait Time Model | Backend built | `POST /api/v1/intelligence/wait-time`, travel/prep/buffer calculation | Needs restaurant location, prep time, order assignment timestamp |
| 11 | 3-Option Charging Decision | Backend built | `POST /api/v1/intelligence/charging/decision`, records/history | Needs real order feed and real charger availability for production claims |
| 12 | V5-A Driver Behavioral Model | Training foundation built | `app/ml/v5a_training.py`, 24-feature list, SOC-quality filtering | Not promoted to production inference; Evify 7.0 replay can now populate proxy behavior data |
| 13 | External APIs | Built foundation | Weather/elevation/directions/places service with H3/cache/quota/fallback; map charger points are ranked from current live driver/fleet GPS context and capped to relevant returned points | Needs production keys, quota monitoring, and real charger inventory/slot provider for full-city availability claims |
| 14 | Personalized Departure Nudge | Partial | route scoring and personal_factor foundations exist | No full ignition-triggered FCM/WhatsApp pipeline yet |
| 15 | Opportunistic Charging Alert | Partial | alert service, wait classifier, charger lookup, stop/SOC foundations | Needs context-aware stop engine and push verification |
| 16 | Trip Digital Twin | Partial | `trips` table, GPS trip inference, vehicle-proxy trip generation, and click-to-view trip trace endpoint/UI exist | Needs richer trip-twin metrics and true driver identity for production-grade coaching |
| 17 | Driver Scorecard & Fleet Intelligence | Partial | `/scorecards`, fleet live, driver behavior history | Formula is basic; needs trip-twin and profile confidence improvements |
| 18 | RL Nudge Optimizer | Future | `nudge_events` outcome fields exist | Needs months of A/B outcome data |
| 19 | V6 Driver Embedding Model | Future | Tables and outcome data path exist | Needs stable driver IDs and 3+ months/500+ trips per driver |
| 20 | Real-Time Streaming Architecture | Future scale path | Current pilot indexes and bulk ingest exist | Build after pilot success or load-test failure |
| 21 | Driver Archetype Classifier | Built | live driver profile archetype output, snapshot fields, and Evify 7.0 vehicle-proxy support | Needs true driver mapping for person-level coaching claims |
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
- Evify 7.0 now gets a vehicle-proxy driver from `RegNo` or `VehicleId`, so trip inference can populate rows even without a real Evify driver ID.

Remaining pilot/production improvement:

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
- `GET /api/v1/auth/signup-options`
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
- `PATCH /api/v1/admin/users/{user_id}/mapping`
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

1. Completed 2026-05-27: ran `alembic upgrade head` and verified revision `0012_access_request_vehicle_hint`.
2. Completed 2026-05-27: added Evify 7.0 aliases to `evify_adapter.py`.
3. Completed 2026-05-27: implemented vehicle-proxy driver creation from `RegNo` or `VehicleId` when no real driver ID exists.
4. Completed 2026-05-27: confirmed generated trip/session rows populate under Evify 7.0 replay.
5. Partially completed 2026-05-27: bounded 500-row bulk replay passed against configured Postgres/Cloud SQL at about 82.55 rows/sec after DB-bound bulk optimization.
6. Still required: full load test `/api/v1/telemetry/evify/bulk`:
   - 500 rows accepted
   - 501 rows rejected with 413
   - 50 concurrent 500-row batches tested
   - use `production/backend/scripts/replay_evify_bulk.py` to replay `Evify data 7.0` into the real bulk endpoint
   - temporarily raise `TELEMETRY_RATE_LIMIT_PER_MINUTE` in staging for capacity testing, or expected HTTP 429 responses will hide DB/API capacity
7. Confirm scheduled WebSocket fanout does not block ingest under dashboard load.
8. Configure/verify `REDIS_URL`, `LIVE_STATE_REDIS_ENABLED=true`, and `LIVE_STATE_TTL_SECONDS=300` for Redis live state, rate limits, cache, and pub/sub in pilot.
9. Verify external API cache/quota behavior under replay.
10. Verify FCM production push receipt on deployed Vercel URL.
11. Keep WhatsApp soft-locked until opt-in, templates, provider, and abuse limits are implemented.

P1 before wider pilot:

1. Persist or compute H3/area clusters for recurring stop zones.
2. Add context-aware stop classifier for traffic/crossroad/signal vs useful wait.
3. Add dashboard labeling that distinguishes vehicle-proxy profile from real driver profile.
4. Expand replay/load-test coverage using Evify Data 7.0.
5. Add telemetry adapter regression tests for Evify 7.0 payload keys.
6. Add performance checks for latest-vehicle/latest-driver queries.
7. Add data-quality dashboard cards for SOC jumps, missing driver IDs, missing charge plug, and GPS gaps.

Latest backend verification - 2026-05-27:

- Backend unit/eval suite: 51 tests passed.
- Backend compile: passed.
- Alembic single-head check: `0012_access_request_vehicle_hint`.
- Configured Postgres/Cloud SQL migration state: `0012_access_request_vehicle_hint (head)`.
- Focused Evify 7.0 adapter/proxy/trip regression tests: 3 passed.
- Bounded Evify 7.0 bulk replay: 500 rows inserted in 6.06s ingest time, about 82.55 rows/sec.

Latest frontend verification - 2026-05-26:

- Frontend lint: passed.
- Frontend production build: passed.
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
- Background FCM is served by `/firebase-messaging-sw.js`; notification clicks now default to `/alerts` unless a safe same-origin `data.url` is provided.
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

Current codebase is stronger after the 2026-05-27 adapter/proxy/replay hardening, but full pilot sign-off still needs concurrency and live-state verification.

The most important blockers are not the AI features. They are:

1. Bulk ingest concurrency test.
2. WebSocket fanout load test.
3. Redis live-state runtime proof in deployed Render environment.
4. External API cache/quota behavior under replay.
5. FCM deployed verification.

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

- Auth future implementation: invite-code or QR onboarding for drivers. Admin should generate an invite linked to an existing driver profile/vehicle proxy; the driver signs up from that invite, so the backend can map `supabase_user_id` to the correct internal `driver_id` without guessing from Gmail/name alone.
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

---

## 14. Latest Production Feature - Mobile Action Button Pilot Foundation

Status: implemented in production codebase on 2026-05-29.

Source:

- `Trickee/mobfeatures.md`
- `Trickee/analysis/mobfeatures.md`
- Extracted: 2026-05-29
- Confidence: High for implemented backend/app scaffold; Medium for field reliability until Android device testing is completed.

Implemented backend surface:

- Added dedicated mobile persistence tables for phone GPS, action-button trip sessions, waiting events, charging sessions, and issue events.
- Added Alembic migration `0013_mobile_action_button`.
- Added `GET /api/v1/mobile/me`.
- Added `POST /api/v1/mobile/location`.
- Added `POST /api/v1/mobile/voice/resolve-destination`.
- Added `POST /api/v1/mobile/trips/start` and `POST /api/v1/mobile/trips/end`.
- Added `POST /api/v1/mobile/charging/start` and `POST /api/v1/mobile/charging/end`.
- Added `POST /api/v1/mobile/waiting/start` and `POST /api/v1/mobile/waiting/end`.
- Added `POST /api/v1/mobile/issues`.
- Added driver-scoped `GET /api/v1/mobile/alerts` and `POST /api/v1/mobile/alerts/{alert_id}/ack`.

Implementation notes:

- Mobile phone GPS is stored separately from Evify vehicle telemetry in `mobile_location_points`.
- Location pings can update Redis live state with `source = android_app` when Redis live-state is enabled.
- Action endpoints accept idempotency keys so the mobile offline queue can retry without duplicating sessions.
- Voice destination handling is backend-owned and currently performs deterministic text cleanup only. External Google Places/Routes or LLM-backed place resolution remains a follow-up because privileged API keys must not live in the mobile app.
- Driver access requires an approved mapped `driver` user with `driver_id`.

Implemented mobile app foundation:

- Added standalone React Native CLI Android app at `production/trickee-driver-mobile`.
- Kept Trickee logic isolated under `src/features/trickee-driver`.
- Added isolated services for backend API, Supabase auth, location tracking, FCM registration, voice input, and offline queue.
- Added Android permissions for foreground/background location, foreground service, notifications, and internet.
- Implemented the MVP action-button gestures:
  - single tap starts voice destination trip flow
  - double tap starts charging
  - swipe right starts waiting
  - long press opens issue reporting
- Added basic trip end, waiting end, charging end, issue submit, and mobile state sync.

Remaining verification:

- Run the React Native app on an Android device/emulator with real Supabase and Firebase config.
- Verify `google-services.json` and FCM delivery through Firebase App Distribution setup.
- Verify background geolocation behavior on target Android versions and battery-optimization settings.
- Add production Google Places/Routes-backed destination resolver on the backend when map API keys and quota policy are finalized.

---

## 15. Latest Pilot Verification - Deployed Bulk Ingest, Redis Live State, And WebSocket Load

Status: verified and documented on 2026-06-02.

Code/doc changes:

- Added `production/backend/tests/test_bulk_ingest_api.py`.
- Updated `production/backend/scripts/replay_evify_bulk.py` so replay batching respects both:
  - max 500 rows per request
  - approximate request body byte cap, default `1,800,000` bytes
- Updated `Trickee/analysis/pilot_testing_plan.md` with deployed verification evidence.
- Pushed commit `f8f4d38` (`Verify deployed ingest and harden replay batching`).

Local regression coverage added:

- 500-row bulk ingest is accepted through the actual FastAPI route.
- 501-row bulk ingest is rejected with HTTP `413`.
- Duplicate `(vehicle_id, recorded_at)` payloads do not create duplicate telemetry rows.

Focused local verification:

- Bulk ingest API regression tests: passed.
- Evify 7.0 adapter/bulk ingest regression tests: passed.
- Redis/live-map fallback preference tests: passed.
- WebSocket manager tests: passed.
- Byte-aware Evify 7.0 replay dry run: 48 files, 90,833 rows, 360 deploy-safe batches.

Deployed Render verification:

| Check | Result |
|---|---|
| `GET /health` | 200 OK |
| `model_ready` | `true` |
| `redis_configured` | `true` |
| `live_state_redis_enabled` | `true` |
| `GET /api/v1/auth/me` | 200 OK as `trickee_admin` |
| 501-row bulk request | HTTP `413`, rejected correctly |
| Generated 500-row bulk request | 200 OK, 500 rows accepted |
| Live map after deployed ingest | Matching point returned `source = redis_live_state` |
| 20 concurrent generated 500-row batches | 20/20 succeeded, 10,000 rows accepted |
| Byte-aware Evify 7.0 deployed replay slice | 20/20 succeeded, 5,000 rows accepted |
| WebSocket fanout with 50 active sockets | Bulk 500-row ingest still returned 200 OK |

Important finding:

- The original 500-row replay assumption was incomplete because deployed middleware also enforces `MAX_REQUEST_BODY_BYTES = 2,000,000`.
- Raw Evify 7.0 records can exceed that byte cap even when row count is 500.
- The replay script now chunks by byte size as well as row count.

Performance interpretation:

- Correctness is verified for deployed auth, row cap, byte-aware replay, Redis live-state, and WebSocket fanout.
- Concurrent bulk replay latency is high and should be treated as backfill/replay behavior, not realtime UX behavior.
- Pilot live telemetry should use smaller frequent batches; 500-row batches are suitable for historical replay/backfill.

Still required before full pilot sign-off:

- FCM deployed verification on the Vercel URL.
- Full 50-concurrency byte-aware raw Evify replay after temporarily raising staging `TELEMETRY_RATE_LIMIT_PER_MINUTE`.
- Single-row ingest latency test with 0, 10, 50, and 100 WebSocket clients.
- Real Android device verification for the React Native driver app.

---

## 16. Rohith Android Mobile Frontend Adoption

Status: adopted as the mobile UI baseline.

What changed:

- Compared the original `origin/main` mobile app with the Rohith Android branch.
- Chose the Rohith mobile frontend as the go-forward driver app UI.
- Restored/kept the Rohith screen structure under:
  - `production/trickee-driver-mobile/src/screens`
  - `production/trickee-driver-mobile/src/components`
  - `production/trickee-driver-mobile/src/navigation`
  - `production/trickee-driver-mobile/src/constants`
  - `production/trickee-driver-mobile/src/theme`

Current interpretation:

- Future mobility features must be integrated into the Rohith UI rather than replacing it.
- UI changes should stay minimal unless the feature genuinely needs a new driver control surface.

---

## 17. Mobile Backend Endpoint Integration

Status: implemented in the recovered mobile source; runtime backend verification still depends on local backend/auth.

Mobile services added/restored:

- `src/services/api.ts`
- `src/services/types.ts`
- `src/services/mobileLocation.ts`
- `src/services/backgroundLocation.ts`
- `src/services/liveMapSocket.ts`
- `src/services/offlineQueue.ts`
- `src/services/nativeQuickActions.ts`

Backend endpoints covered by the mobile service layer:

- `GET /api/v1/mobile/me`
- `GET /api/v1/mobile/alerts`
- `POST /api/v1/mobile/alerts/{alert_id}/ack`
- `POST /api/v1/mobile/location`
- `POST /api/v1/mobile/trips/start`
- `POST /api/v1/mobile/trips/end`
- `POST /api/v1/mobile/charging/start`
- `POST /api/v1/mobile/charging/end`
- `POST /api/v1/mobile/waiting/start`
- `POST /api/v1/mobile/waiting/end`
- `POST /api/v1/mobile/issues`
- `POST /api/v1/assistant/message`

Remaining work:

- Add mobile API methods for:
  - `POST /api/v1/mobile/voice/resolve-destination`
  - `POST /api/v1/mobile/voice/copilot`
- Use those methods from the Trip voice destination flow and Copilot voice flow.

---

## 18. Background GPS, Offline Queue, And Live State

Status: implemented as app services; production reliability requires device validation.

Implemented:

- Foreground mobile location posting.
- Background location service wrapper.
- Offline queue for retryable mobile events.
- Live-map WebSocket connection and snapshot merge into mobile state.
- Tracking-state derivation for ready/trip/waiting/charging/emergency context.

Remaining work:

- Validate on physical Android hardware with battery optimization enabled/disabled.
- Resolve `react-native-background-geolocation` license status before production field testing.
- Confirm backend deduplication and offline replay behavior with real network interruptions.

---

## 19. Android OS Quick Access

Status: implemented and emulator-verified for tile visibility.

Implemented native Android bridge:

- `TrickeeActionModule.kt`
- `TrickeeActionPackage.kt`
- `TrickeeActionReceiver.kt`
- `TrickeeQuickActions.kt`
- `TrickeeQuickTileService.kt`

System surfaces:

- Persistent notification actions:
  - SOS
  - Copilot
  - Trip
  - Charging
- Quick Settings tiles:
  - `Trickee SOS`
  - `Trickee Copilot`
  - `Trickee Trip`
  - `Trickee Charge`

Current dispatch behavior:

- SOS -> `POST /api/v1/mobile/issues`
- Trip -> `POST /api/v1/mobile/trips/start` or `/end`
- Charging -> `POST /api/v1/mobile/charging/start` or `/end`
- Copilot -> `POST /api/v1/assistant/message`

Android behavior note:

- Quick Settings tiles are not auto-added by Android. Drivers must add them from the Quick Settings edit panel unless the app later uses Android 13+ `StatusBarManager.requestAddTileService`.

Remaining work:

- Add a `Trickee Wait` tile if waiting must be available from the top panel.
- Add distinct tile icons instead of the generic launcher icon.
- Validate tile taps end-to-end with a real authenticated backend session.

---

## 20. Android Build And Emulator Demo

Status: local command-line emulator demo was working before the reset; source has been restored.

Build/tooling changes:

- JDK 17 installed/configured.
- Android SDK command-line tooling installed.
- API 34 emulator image installed.
- API 35 platform installed for AndroidX Work compatibility.
- NDK `27.1.12297006` installed.
- AVD created:
  - `Trickee_API_34`
- Build compatibility updates:
  - `compileSdkVersion = 35`
  - `minSdkVersion = 24`
  - `android.suppressUnsupportedCompileSdk=35`
  - `reactNativeArchitectures=x86_64` for emulator demo builds
  - Android manifest label override with `tools:replace`

Important workaround:

- Reanimated/Ninja fails when building from the long OneDrive path.
- Building from a short `T:\` subst path allowed `:app:installDebug` to pass.

Verified before reset:

- Debug APK installed on emulator.
- App launched as `com.trickeeandroid/.MainActivity`.
- Metro served the bundle after `adb reverse tcp:8081 tcp:8081`.
- Rohith onboarding UI rendered.
- Quick Settings tiles were visible after adding them to the emulator.

Remaining work:

- Re-run `:app:installDebug` after the current recovery to confirm the restored tree still builds.
- Parameterize emulator-only ABI settings before physical-device/release builds.

---

## 21. Reset Recovery State

Status: repaired on 2026-06-25.

Problem:

- A local `git reset --hard HEAD~1` and branch switching reverted tracked files to `origin/main`.
- Recent analysis entries were uncommitted and disappeared from `daily_logger.md`.
- The current branch no longer contained the recovered mobile source until it was restored.

Recovery:

- Located reflog commit:
  - `8f697f7 mobile-voice features done`
- Restored:
  - `production/trickee-driver-mobile`
- Reconstructed missing analysis history in:
  - `Trickee/analysis/daily_logger.md`
  - `Trickee/analysis/built_implementation_and_remaining_work.md`

Current truth after recovery:

- Rohith mobile UI source is back in the working tree.
- Backend service layer and quick action native bridge are back.
- Four Quick Settings tiles are back in source.
- The current Rohith UI still does not contain the final gesture Action Button implementation.
- The current Rohith UI still does not contain the full `Trickee Trip` voice destination flow.

Next implementation target:

- Add the in-app driver Action Button gesture layer:
  - single tap -> start trip with voice destination
  - double tap -> start charging
  - swipe right -> start waiting
  - long press -> emergency/issue
  - swipe left -> end trip
- Add the voice layer for `Trickee Trip`:
  - request microphone permission
  - capture regional-language speech with `@react-native-voice/voice`
  - send transcript to backend `/mobile/voice/resolve-destination`
  - start trip with resolved destination text/confidence
  - keep raw audio off the mobile/backend MVP unless explicitly required

---

## 22. Post-Reset Empty Folder Cleanup

Status: completed on 2026-06-25.

Cleanup performed:

- Removed empty reset leftovers under `production/trickee-driver-mobile`.
- Removed only directories that were confirmed empty.
- Removed old scaffold shells including:
  - empty `src/features`
  - empty old `src/services/trickee*` folders
  - empty old Android package folder `android/app/src/main/java/com/trickeedrivermobile`
  - empty iOS shell folders
  - empty `__tests__`

Verification:

- Full repository empty-directory scan now returns:
  - `EMPTY_COUNT=0`

Current caution:

- The working tree still has a large diff against `origin/main` because the restored Rohith mobile state is intentionally different from main.
- This cleanup did not stage or commit the recovered mobile work.

---

## 23. Mobile Validation And Push Gate

Status: partially validated on 2026-06-25; not pushed.

Checks run:

- `npm.cmd run lint`
- `npx.cmd tsc --noEmit`
- Android `:app:assembleDebug` attempted with cached Gradle 8.3 and the short `T:\` path workaround.

Results:

- Lint passed with warnings only.
- TypeScript passed.
- Android build did not complete because Gradle dependency resolution needs artifacts that are not available offline in this sandbox.

Observed Android build blocker:

- Gradle wrapper download is blocked by sandbox network restrictions.
- Cached Gradle can run, but offline resolution fails for Android/Gradle/Kotlin artifacts such as:
  - `com.android.tools.build:gradle:8.2.1`
  - `org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.22`
  - related transitive dependencies

Decision:

- No branch was pushed because the requested condition was to push only after a good build check.
- Next push attempt should happen after running `:app:assembleDebug` in an environment with normal Gradle network access or a complete Gradle cache.

Follow-up:

- User ran the Android build locally from the short `T:\android` path after cleanup.
- Result:
  - `BUILD SUCCESSFUL in 3m 7s`
  - `263 actionable tasks: 259 executed, 4 up-to-date`
- This clears the Android build gate for pushing the recovered mobile branch.

---

## 24. Latest Mobile Branch Pull And App Launch

Status: completed on 2026-06-30.

Branch state:

- Current branch:
  - `codex/recover-rohith-mobile-build`
- Pulled latest remote commit:
  - `197280e Update package-lock peer deps, env example, add rohith-trickee-android scaffold`
- Local branch is aligned with:
  - `origin/codex/recover-rohith-mobile-build`

Runtime start:

- Started Metro from:
  - `production/trickee-driver-mobile`
- Booted emulator:
  - `Trickee_API_34`
- Installed existing debug APK directly with:
  - `adb install -r`
- Launched:
  - `com.trickeeandroid/.MainActivity`

Verification:

- Metro dev server ready.
- Emulator online as `emulator-5554`.
- APK install returned `Success`.
- App process was running.
- Android foreground focus confirmed `com.trickeeandroid.MainActivity`.

Current caution:

- `:app:installDebug` still intermittently fails on Gradle/CMake output snapshotting.
- Direct APK install works after the successful `assembleDebug` artifact exists.
- The latest pulled commit did not change mobile source behavior; it updated lock/env/scaffold metadata.

---

## 25. Local Backend Login And Emulator Demo Stabilization

Status: implemented on 2026-06-30.

Built/changed:

- Local backend demo startup path:
  - `.env` configured locally for SQLite, legacy auth, and demo seed.
  - Demo seed run with Python 3.11.
  - Uvicorn backend started on `0.0.0.0:8000`.
- Mobile API path:
  - Android continues to use `http://10.0.2.2:8000/api/v1`.
  - Driver login verified with the seeded demo account.
- Rohith UI preservation:
  - No layout or visual redesign was made.
  - Invalid Copilot icon prop was changed from `microphone-message` to a supported MaterialCommunityIcons name, `account-voice`.
- Local emulator stability:
  - Native background GPS is gated off for the current local AOSP emulator.
  - The background GPS service code remains in the app for a Google Play Services emulator or physical device.

Verification:

- Backend is reachable on port 8000.
- `/api/v1/auth/login` returns a valid driver token for `driver1@evify.in`.
- App successfully moved past the sign-in screen and loaded the Rohith dashboard.

Remaining production requirement:

- Re-enable and validate `react-native-background-geolocation` on a real Google Play Services Android target.
- Configure the valid package/license path for `com.trickeeandroid`.
- Re-run Android build and device test after that native GPS configuration is ready.
