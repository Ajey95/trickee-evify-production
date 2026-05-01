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

Demo users:

- `admin@trickee.ai` / `Trickee@2026`
- `fleet@evify.in` / `Evify@2026`
- `driver1@evify.in` / `Driver@2026`

## Key Endpoints

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/firebase-login`
- `POST /api/v1/auth/fcm-token`
- `GET /api/v1/auth/me`
- `GET /api/v1/vehicles`
- `POST /api/v1/telemetry/evify`
- `POST /api/v1/telemetry/evify/bulk`
- `POST /api/v1/predictions/infer/{vehicle_id}`
- `POST /api/v1/routes/score`
- `GET /api/v1/alerts`
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

## Firebase Auth + FCM

Firebase is used only for identity and push delivery. Trickee still owns RBAC, fleet/driver mapping, telemetry, predictions, alerts, and training data in Postgres.

Auth flow:

```text
Frontend Firebase login -> Firebase ID token -> POST /auth/firebase-login -> Trickee JWT
```

The backend maps Firebase users by `firebase_uid` first, then by email. If a Firebase email exists in the Trickee `users` table, the first Firebase login links that user to the Firebase UID. Unknown Firebase users are rejected until they are created/mapped in Trickee.

Required backend env when enabling Firebase:

```text
FIREBASE_AUTH_ENABLED=true
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

## Free Cloud Deployment

Recommended free path for this project scope:

- Backend: Render Free web service using Docker.
- Database: Supabase Free Postgres.
- Frontend: Vercel Free once the frontend is shared.

Why this path: Render Free web services support Python/Docker apps, managed TLS, and custom domains, but spin down after idle time. Render Free Postgres is useful only for short demos because it expires after 30 days. Supabase Free gives a normal hosted Postgres project that is better for a continuing MVP.

Use `render.yaml` at the repo root as the Render blueprint. Set `DATABASE_URL` to the Supabase pooled Postgres URL and append `?sslmode=require` if Supabase provides a direct Postgres URL requiring SSL.

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
