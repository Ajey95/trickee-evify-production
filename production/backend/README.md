# Trickee Production Backend

FastAPI backend for the Trickee EV Intelligence Platform.

Authoritative model assets are in `models_ml/`:

- `battery_model_v4_1.pth`
- `scaler_v4_1.joblib`
- `y_scaler_v4_1.joblib`

Important contract: `delta_soc` is the model target/output only. It is not an input feature.

V5-A candidate artifacts can also live in `models_ml/`:

- `battery_model_v5a.pth`
- `scaler_v5a.joblib`
- `y_scaler_v5a.joblib`
- `v5a_training_report.json`

V4.1 remains the production default until the V5-A candidate beats the V4.1 validation metric.

## Local Setup

```powershell
cd production/backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
alembic upgrade head
python -m app.utils.seed
uvicorn app.main:app --reload --port 8000
```

Demo users are seeded for local development. Production uses Google OAuth: create a matching backend `users` row by email, then the first successful Google login links `users.google_sub`. Backend password login works only when `LEGACY_AUTH_ENABLED=true`.

- `admin@trickee.ai` / `Trickee@2026`
- `fleet@evify.in` / `Evify@2026`
- `driver1@evify.in` / `Driver@2026`

## Key Endpoints

- `GET /api/v1/auth/me`
- `GET /api/v1/auth/ws-ticket`
- `POST /api/v1/auth/google-login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/login` (legacy rollback only)
- `POST /api/v1/auth/firebase-login` (optional Firebase auth only)
- `POST /api/v1/auth/fcm-token`
- `GET /api/v1/vehicles`
- `POST /api/v1/telemetry/evify`
- `POST /api/v1/telemetry/evify/bulk`
- `POST /api/v1/predictions/infer/{vehicle_id}`
- `POST /api/v1/routes/score`
- `POST /api/v1/routes/explain`
- `GET /api/v1/alerts`
- `POST /api/v1/notifications/personalize`
- `POST /api/v1/assistant/message`
- `POST /api/v1/battery/insight`
- `POST /api/v1/chargers/recommend`
- `GET /api/v1/drivers/{driver_id}/profile`
- `POST /api/v1/drivers/{driver_id}/profile/update`
- `POST /api/v1/drivers/{driver_id}/coaching`
- `POST /api/v1/fleet/summary`
- `GET /api/v1/mobile/me`
- `POST /api/v1/mobile/location`
- `POST /api/v1/mobile/voice/resolve-destination`
- `POST /api/v1/mobile/voice/copilot`
- `POST /api/v1/mobile/trips/start`
- `POST /api/v1/mobile/trips/end`
- `POST /api/v1/mobile/charging/start`
- `POST /api/v1/mobile/waiting/start`
- `POST /api/v1/mobile/issues`
- `GET /api/v1/admin/metrics`

## Future Roadmap APIs

Implemented backend support for the V5/V5-D roadmap:

- `GET /api/v1/intelligence/drivers/{driver_id}/behavior`
- `POST /api/v1/intelligence/context`
- `POST /api/v1/intelligence/wait-time`
- `POST /api/v1/intelligence/orders/assign`
- `POST /api/v1/intelligence/charging/decision`
- `GET /api/v1/intelligence/history/waits`

External keys are optional. Without keys, the services use deterministic fallbacks suitable for demos and tests.

External context requests are cost controlled:

- Google Places, Directions, and Elevation share a daily provider quota.
- OpenWeather has a separate daily provider quota.
- H3 spatial cache keys deduplicate nearby charger, route, elevation, and weather lookups.
- Redis persists context cache entries across workers when `REDIS_URL` is configured.

```text
EXTERNAL_CONTEXT_H3_ENABLED=true
EXTERNAL_CONTEXT_H3_RESOLUTION=10
EXTERNAL_CONTEXT_WEATHER_H3_RESOLUTION=6
```

## AI Features 1-8

Features 1-8 are implemented through grounded backend tools plus a shared AI client:

- The backend computes decisions, scores, risk, profiles, charger rank, and fleet facts.
- The LLM is used only for wording, explanation, summaries, and conversational composition.
- Every AI feature has deterministic fallback text when `GROQ_API_KEY` is blank or the model fails.
- Tool calls and AI calls are logged in `tool_call_logs` and `ai_interaction_logs`.
- Feature records are stored in `notification_personalization_logs`, `assistant_messages`, `driver_profile_snapshots`, `driver_coaching_events`, and `fleet_summary_logs`.
- Prompt-injection text is treated as untrusted input and cannot bypass tool grounding.
- Assistant responses now include orchestrator/specialist agent metadata and grounded evidence summaries.

Production AI/rate-limit envs:

```text
LLM_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GROQ_API_KEY=
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

For Google-tech-first submission, keep Gemini as the primary provider and Groq as optional fallback.

## Google OAuth, Legacy Rollback, And FCM

Google OAuth is the production identity provider. Clients send a Google ID token to `POST /api/v1/auth/google-login`; the backend verifies it with configured OAuth client IDs and returns a short-lived Trickee access token plus a rotating refresh token.

```text
AUTH_REQUIRED_PROVIDER=google
GOOGLE_OAUTH_CLIENT_IDS=<web-client-id>,<android-client-id>
REFRESH_TOKEN_EXPIRE_DAYS=30
```

The backend maps the Google JWT `sub` to `users.google_sub`; if that is not populated yet, it falls back to the verified Google email and links the row on first successful request. Trickee still owns app authorization through the internal `users.role`, `fleet_id`, and `driver_id` fields.

Set `LEGACY_AUTH_ENABLED=true` only for emergency rollback to the old password endpoint.

## Security And Production Controls

Implemented production controls:

- Request-size guard through `MAX_REQUEST_BODY_BYTES`.
- Request IDs and secure response headers on API responses.
- Generic internal-error responses with server-side exception logging.
- Redis-backed rate limiting when `REDIS_URL` is set, with in-process fallback for local development.
- Separate limits for auth, telemetry ingest, intelligence workflows, prediction inference, and WebSocket tickets.
- External context cost guard for Google/OpenWeather calls:
  - in-process cache for fast repeated requests
  - Redis-backed cross-worker cache when `REDIS_URL` is set
  - stale cached fallback when daily quota is exhausted
  - daily provider circuit breakers through `GOOGLE_EXTERNAL_DAILY_LIMIT` and `OPENWEATHER_EXTERNAL_DAILY_LIMIT`
- Short-lived backend access JWTs plus opaque refresh tokens stored hashed in Postgres.
- Security event audit records for legacy/Firebase login success and failure paths.
- Supabase-only RLS baseline migration when the database exposes the `auth` schema.

Use Redis in production for rate limits and external-context caching because in-memory limits/cache are per process and reset on deploy. This is especially important before enabling Google Maps/Places keys.

## Firebase FCM

Firebase is now used primarily for push delivery. Trickee still owns RBAC, fleet/driver mapping, telemetry, predictions, alerts, and training data in Postgres.

Required backend env when enabling FCM:

```text
FIREBASE_AUTH_ENABLED=false
FIREBASE_FCM_ENABLED=true
FIREBASE_PROJECT_ID=<firebase-project-id>
FIREBASE_SERVICE_ACCOUNT_JSON=<single-line-service-account-json>
```

Alternatively set `FIREBASE_SERVICE_ACCOUNT_PATH` to a deployed service-account JSON file path.

Push flow:

```text
Frontend gets browser FCM token -> POST /auth/fcm-token -> backend stores device_push_tokens
```

Charging opportunity alerts attempt an FCM push to the assigned driver and fleet operator users when active tokens exist. Dashboard nudges remain the fallback channel.

## Wait-Time Requirement

Evify is not required to send computed wait time. Evify only needs to provide raw telemetry such as GPS, speed, ignition, SOC, and charge status.

Trickee owns wait-time intelligence:

- Crossroad / traffic wait: inferred from ignition ON, speed near zero, stop duration, and not being inside a restaurant geofence.
- Restaurant / pickup wait: inferred from restaurant/order location, speed near zero, stop duration, and active order context.
- Idle wait: inferred from ignition OFF or long stationary periods away from restaurant and charger zones.
- Charging wait: inferred from charge plug/status, SOC rise, or charger proximity.

Live Evify ingestion writes classified wait windows into `wait_events`. A stop continues while the vehicle remains stationary in the same inferred wait type, and closes when the vehicle moves or the wait type changes.

When order context is available from the frontend/order system, Trickee combines telemetry-derived stop time with order prep data:

```text
total_wait_window = travel_time_to_restaurant + restaurant_prep_time + handover_buffer
chargeable_time = restaurant_prep_time + handover_buffer
restaurant_live_chargeable_time = current_stop_duration + restaurant_prep_time + handover_buffer
```

This means order wait usage, charging opportunity, and smart order assignment are calculated inside Trickee. They are not expected from Evify telemetry.

## Evify Live / File Ingestion

The production adapter accepts the latest Evify `CanData` shape with `Name`/`Value` rows.

Decisions encoded in the adapter:

- `delta_soc` is never accepted as an input.
- `CellVoltage_Min` and `CellVoltage_Max` are used as `abs(max - min)` for `cell_imbalance_mv`.
- `Battery Current` is the preferred model current signal; if it is missing/zero/implausible, sane `MCU DC Current` is used.
- `Latitude = 0` or `Longitude = 0` becomes `None`, so route/elevation logic can ignore bad GPS rows.
- `driverID` is treated as real driver identity and auto-creates a driver if needed.
- Trips are inferred from GPS + ignition + speed when Evify does not send a `trip_id`.

Import a received Evify JSON folder into the configured database:

```powershell
python -m app.utils.ingest_evify_json "C:\Users\srija\Downloads\Trickee\evify-28-04-data\evify data 6.0"
```

For large historical dumps such as the 28-04 folder, use fast backfill mode. It keeps the same normalization and physics-derived fields, but bulk inserts telemetry and skips per-row live side effects such as wait/trip/alert processing:

```powershell
python -m app.utils.backfill_evify_json "C:\Users\srija\Downloads\Trickee\evify-28-04-data\evify data 6.0" --batch-size 5000
```

Use `/telemetry/evify` or `ingest_evify_json.py` for true live replay/demo side effects.

## V5-A Training

Train the driver-behavior candidate model from real Evify JSON:

```powershell
python -m app.utils.train_v5a "C:\Users\srija\Downloads\Trickee\evify-28-04-data\evify data 6.0" --output-dir models_ml --epochs 12
```

The V5-A feature contract is 24 columns: the V4.1 20-feature physics window plus:

- `driver_avg_current_30m`
- `driver_avg_speed_30m`
- `driver_regen_ratio_30m`
- `driver_throttle_var_30m`

Use `models_ml/v5a_training_report.json` to decide whether to promote V5-A.

## V5/V6-Ready Learning Store

The backend persists the history needed for V5-A improvement and later V6 training:

- `trips`: GPS + ignition inferred trips when Evify does not send `trip_id`.
- `driver_behavior_snapshots`: rolling 30-minute driver behavior metrics over time.
- `nudge_events`: dashboard nudges/alerts and later push-notification outcomes.
- `order_assignment_decisions`: V5-D dispatcher decisions and ranked driver payloads.
- `charging_decision_records`: Option A/B/C charging decisions, wait windows, and selected charger.
- `wait_events`: Trickee-classified traffic, restaurant, idle, and charging wait intervals.

These records are intentionally kept separate from model inference. V4.1 remains the serving model, while these tables collect the longitudinal driver/order/nudge outcomes needed to promote V5-A or train V6 later.

## Time-Series Storage For Pilot

The current cloud database is Supabase Postgres 17.6. This Supabase project does not expose the `timescaledb` extension, so telemetry cannot be converted into a real Timescale hypertable in-place.

Pilot-ready time-series optimization is implemented in migration `0005_timeseries_pilot_indexes`:

- `pg_partman` extension enabled where available.
- Composite latest-point indexes:
  - `telemetry(vehicle_id, recorded_at DESC)`
  - `telemetry(driver_id, recorded_at DESC)`
- Time-window indexes:
  - btree on `telemetry(recorded_at DESC)`
  - BRIN on `telemetry(recorded_at)`
- Supporting descending indexes for predictions, waits, trips, and alerts.

This keeps the current FastAPI/Supabase deployment stable for pilot testing. If sustained Evify traffic grows beyond what indexed Supabase Postgres can comfortably handle, the next migration target should be Timescale/TigerData Cloud or self-hosted Postgres with TimescaleDB enabled.

Useful history endpoints:

- `GET /api/v1/drivers/{driver_id}/trips`
- `GET /api/v1/intelligence/history/driver-behavior`
- `GET /api/v1/intelligence/history/nudges`
- `GET /api/v1/intelligence/history/order-assignments`
- `GET /api/v1/intelligence/history/charging-decisions`
- `GET /api/v1/intelligence/history/waits`

## GCP Cloud Deployment

Recommended path for this project scope:

- Backend: Google Cloud Run using Docker.
- Database: Google Cloud SQL Postgres.
- Frontend: Vercel Free once the frontend is shared.

Use `scripts/deploy_cloud_run.ps1` from this backend folder. Set `DATABASE_URL` to the GCP Postgres URL, set `GOOGLE_OAUTH_CLIENT_IDS`, and pass the Cloud SQL instance connection name when deploying with the Cloud SQL connector.

## Railway + Cloud PostgreSQL

The PRD deployment path is Railway for both API and PostgreSQL.

1. Create a Railway project and add a PostgreSQL database.
2. Deploy this `production/backend` folder as a Docker service.
3. Set Railway service variables from `.env.production.example`.
4. Use Railway's generated `DATABASE_URL`; the app accepts both `postgres://` and `postgresql://`.
5. Keep `MODEL_DIR=models_ml` so the bundled V4.1 `.pth` and `.joblib` files load inside the container.

The Docker command runs:

```bash
alembic upgrade head && python -m app.utils.seed && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

The seed script is guarded and will skip if users already exist, so deploy restarts will not wipe demo data.
