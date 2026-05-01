# Trickee Future Roadmap V2

**Date:** April 2026  
**Scope:** Current backend/demo status, V5/V6 foundations, pending work, future-data needs, and architecture direction.

---

## 1. Executive Summary

Trickee now has a production-grade backend MVP that can ingest Evify telemetry, run the V4.1 SOC/range model, support JWT role-based access, classify wait time, make V5-D order/charging decisions, and persist the learning data needed for future V5/V6 training.

The current demo architecture is intentionally simple:

```text
Evify JSON / live webhook
        ->
FastAPI REST ingestion
        ->
Postgres tables
        ->
V4.1 prediction + dashboard APIs + intelligence APIs
```

This is the correct architecture for the current demo and frontend handoff. It is deployable on free cloud and avoids adding MQTT, Redis, or TimescaleDB before the volume requires them.

The future scale architecture remains:

```text
Evify scooter telemetry
        ->
MQTT broker / streaming queue
        ->
consumer workers
        ->
TimescaleDB for history + Redis for live state
        ->
model inference, retraining, alerts, dashboard APIs
```

Do not move to the scale architecture until live telemetry frequency, fleet size, or dashboard latency requires it.

---

## 2. What Is Done

### 2.1 Backend Foundation

Done:

- FastAPI backend under `production/backend`.
- SQLAlchemy ORM models and Alembic migrations.
- Auth with role-based access:
  - `trickee_admin`
  - `fleet_operator`
  - `driver`
- Firebase Auth foundation:
  - optional Firebase email/password login from the frontend
  - backend Firebase ID token verification
  - Firebase UID mapped back to the Trickee `users` table
  - Trickee JWT still used for protected backend APIs
- FCM push foundation:
  - browser push token registration
  - active device tokens stored in `device_push_tokens`
  - charging opportunity alerts can send push notifications when Firebase is configured
- Seed script with demo users and seed guard.
- CORS and environment configuration.
- Docker/Render-ready deployment setup.
- Free cloud direction documented:
  - Backend: Render Free
  - Database: Supabase Free Postgres
  - Frontend: Vercel Free

### 2.2 V4.1 Model Serving

Done:

- V4.1 remains production serving model.
- Model assets are loaded from `models_ml`:
  - `battery_model_v4_1.pth`
  - `scaler_v4_1.joblib`
  - `y_scaler_v4_1.joblib`
- Inference uses a 20-step telemetry window.
- `delta_soc` is correctly treated as target/output only.
- `delta_soc` is not accepted as an input feature.
- Backend stores predictions in `predictions`.
- Dynamic range calculation is served with prediction output.

Current model decision:

- Keep V4.1 as production default.
- V5-A candidate exists but should not be promoted until it beats V4.1 validation clearly.

### 2.3 Evify Ingestion

Done:

- Live/file ingestion accepts latest Evify `CanData` shape with `Name`/`Value` rows.
- Batch ingestion supports folders of Evify JSON files.
- `driverID` is treated as real driver identity.
- Drivers are auto-created when real `driverID` appears.
- Zero GPS rows are handled safely:
  - `Latitude = 0` or `Longitude = 0` becomes `None`.
- Current signal decision:
  - prefer `Battery Current`
  - fallback to sane `MCU DC Current`
  - reject implausible current spikes.
- Cell imbalance decision:
  - use `abs(CellVoltage_Max - CellVoltage_Min)`.
- Physics features are computed internally.

### 2.4 Core APIs

Done:

- Auth:
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/firebase-login`
  - `POST /api/v1/auth/fcm-token`
  - `GET /api/v1/auth/me`
  - `POST /api/v1/auth/logout`
- Vehicles:
  - `GET /api/v1/vehicles`
  - `GET /api/v1/vehicles/{vehicle_id}`
  - `GET /api/v1/vehicles/{vehicle_id}/telemetry`
- Drivers:
  - `GET /api/v1/drivers`
  - `GET /api/v1/drivers/me`
  - `GET /api/v1/drivers/{driver_id}`
  - `GET /api/v1/drivers/{driver_id}/trips`
- Telemetry:
  - `POST /api/v1/telemetry/evify`
  - `POST /api/v1/telemetry/evify/bulk`
- Predictions:
  - `POST /api/v1/predictions/infer/{vehicle_id}`
  - `GET /api/v1/predictions/{vehicle_id}/history`
- Routes:
  - `POST /api/v1/routes/score`
  - `POST /api/v1/routes/reroute`
- Alerts:
  - `GET /api/v1/alerts`
  - `POST /api/v1/alerts/{alert_id}/resolve`
- Admin:
  - `GET /api/v1/admin/metrics`
  - `GET /api/v1/admin/users`

### 2.5 V5-D Order, Wait, and Charging Intelligence

Done from April 23 discussion:

- Smart order assignment:
  - low-SOC driver can be prioritized when restaurant wait is long enough and range is safe.
  - endpoint: `POST /api/v1/intelligence/orders/assign`
- True wait-time estimator:
  - combines travel time, restaurant prep time, handover buffer, and observed stop duration.
  - endpoint: `POST /api/v1/intelligence/wait-time`
- Wait classifier:
  - `restaurant_wait`
  - `traffic_wait`
  - `idle_wait`
  - `charging_wait`
  - `moving`
  - `approach_window`
- Wait event persistence:
  - stored in `wait_events`.
  - live telemetry extends/closes wait windows.
- Charging decision engine:
  - Option A: charge near restaurant during wait.
  - Option B: detour to charger before pickup.
  - Option C: deliver directly.
  - endpoint: `POST /api/v1/intelligence/charging/decision`
- History endpoints:
  - `GET /api/v1/intelligence/history/waits`
  - `GET /api/v1/intelligence/history/order-assignments`
  - `GET /api/v1/intelligence/history/charging-decisions`

Important decision:

Evify does not need to calculate wait time. Evify sends raw telemetry only. Trickee calculates wait intelligence from GPS, speed, ignition, charge status, and order context.

### 2.6 V5/V6 Learning Store

Done:

- `trips`
- `driver_behavior_snapshots`
- `nudge_events`
- `order_assignment_decisions`
- `charging_decision_records`
- `wait_events`

These tables are not just dashboard tables. They are the future training memory for V5-A improvement, V5-D learning, and later V6.

---

## 3. Foundations Done That Need Future Data

These items are structurally implemented, but their real value comes only after we collect enough live longitudinal data.

### 3.1 Driver Behavior Learning

Foundation done:

- Real `driverID` flows into backend.
- Driver records are created from Evify telemetry.
- Rolling behavior snapshots can be persisted:
  - average current
  - average speed
  - regen ratio
  - throttle variance
  - style label

Needs future data:

- Multiple weeks/months of telemetry per real driver.
- Enough trips per driver across different routes, traffic conditions, and battery levels.
- Driver identity consistency from Evify.

Future use:

- Promote a stronger V5-A driver-behavior model.
- Build reliable driver scorecards.
- Train V6 driver embeddings.

### 3.2 Trip Digital Twin

Foundation done:

- Trips can be inferred from GPS, speed, ignition, and SOC.
- Trips are stored even if Evify does not send a `trip_id`.

Needs future data:

- Cleaner route-level GPS traces.
- Actual trip/order boundaries if Evify or frontend can provide them.
- Actual destination/order context.

Future use:

- Route energy reconstruction.
- Driver-vs-fleet comparison.
- Trip-level SOC prediction and explanation.
- V6 digital twin.

### 3.3 Nudge Outcomes

Foundation done:

- Alerts/nudges can be stored in `nudge_events`.
- Nudge status and outcome fields exist.

Needs future data:

- Whether driver saw the nudge.
- Whether driver acknowledged it.
- Whether driver followed it.
- SOC/range/behavior impact after the nudge.

Future use:

- Learn which nudge types actually work.
- Build behavioral coaching.
- Later RL or bandit-style nudge optimizer.

### 3.4 Order Assignment Outcomes

Foundation done:

- Order assignment decisions are persisted.
- Ranked drivers, chosen driver, strategy, and scoring payload can be stored.

Needs future data:

- Actual order accepted/rejected outcome.
- Pickup time.
- Delivery time.
- Cancellation/late delivery flags.
- Driver SOC before and after order.
- Whether the low-SOC/wait strategy improved operations.

Future use:

- Learn better dispatch scoring.
- Optimize assignment for range, delay, and charging opportunity.
- Prove business value to Evify.

### 3.5 Charging Decision Outcomes

Foundation done:

- Option A/B/C charging decisions are persisted.
- Selected charger and wait window are stored.

Needs future data:

- Whether driver actually charged.
- Start/end SOC during wait.
- Charger availability.
- Real plug-in duration.
- Delivery impact caused by charging.

Future use:

- Learn when charging during wait is actually worth it.
- Tune `chargeable_min` thresholds.
- Recommend the best charging strategy per driver/location/order.

### 3.6 Wait Classification

Foundation done:

- Trickee classifies traffic, restaurant, idle, and charging waits.
- Wait windows are stored from telemetry.

Needs future data:

- Real restaurant/order locations from frontend/order system.
- Actual pickup time and handover time.
- Better geofences for restaurants, depots, chargers, and traffic-heavy intersections.

Future use:

- Improve chargeable wait estimation.
- Separate crossroad waiting from restaurant waiting.
- Avoid recommending charging during traffic stops.

---

## 4. What Is Yet To Be Implemented

### 4.1 Frontend Integration

Pending:

- Connect completed frontend to backend endpoints.
- Wire dashboards to:
  - vehicles
  - predictions
  - alerts
  - wait history
  - order assignments
  - charging decisions
  - driver behavior history
- Add UI for order assignment and charging decisions.
- Add UI for wait classification:
  - traffic wait
  - restaurant wait
  - charging wait
  - idle wait

### 4.2 Real Push Notifications

Current state:

- Dashboard alert/nudge persistence exists.

Pending:

- WhatsApp/SMS delivery.
- FCM is now foundation-ready; production still needs real Firebase project keys, VAPID key, and user devices to register tokens.
- Driver acknowledgement flow.
- Outcome tracking from real driver action.

### 4.3 Real External API Production Use

Current state:

- External-context service supports fallback behavior.
- Optional keys can be configured.

Pending:

- Production Google Maps Directions usage.
- Production Google Places charger lookup.
- Production OpenWeatherMap.
- Production elevation/traffic data.
- Rate-limit and cost controls.
- Caching of repeated external API calls.

### 4.4 Better Restaurant and Order Context

Current state:

- Wait estimator accepts restaurant location and prep time.
- Fallback restaurant clusters exist for demo.

Pending:

- Frontend/order system must provide:
  - order ID
  - restaurant lat/lng
  - customer lat/lng
  - prep estimate
  - order assigned time
  - pickup/handover time
  - delivery completion time

### 4.5 V5-A Promotion

Current state:

- V5-A candidate training flow exists.
- Candidate artifacts can be generated.
- V4.1 remains production default.

Pending:

- More real data.
- Driver-level validation split.
- Promotion criteria.
- Regression testing against V4.1.
- Model registry/versioning decision.

### 4.6 V6 Model

Current state:

- Data foundations are in place.

Pending:

- Driver embedding model architecture.
- Minimum data threshold per driver.
- Training pipeline for embeddings.
- Trip digital twin feature set.
- Offline evaluation.
- Online rollout strategy.

### 4.7 Observability and Operations

Pending:

- Structured logs.
- Error monitoring.
- Request latency tracking.
- Model inference latency tracking.
- Data drift monitoring.
- Failed ingestion quarantine table.
- Admin job dashboard for imports/retraining.

---

## 5. Current Demo Architecture Explained

The current architecture is optimized for:

- fast demo delivery
- frontend handoff
- low cost
- simple deployment
- understandable API contracts
- safe future evolution

Current flow:

```text
Evify JSON / file upload / webhook
        ->
FastAPI telemetry adapter
        ->
data normalization
        ->
physics feature computation
        ->
Postgres storage
        ->
V4.1 inference + intelligence services
        ->
frontend dashboards
```

Why this is okay:

- REST is enough for current data volume and demo needs.
- Supabase Postgres is enough for persistence.
- Render can run the FastAPI backend and model files.
- V4.1 model files are bundled locally, so no extra ML hosting is required.
- Learning-store tables allow future model improvement without changing the demo architecture.

Known tradeoffs:

- Render Free can sleep after inactivity.
- REST ingestion is not ideal for very high-frequency telemetry at fleet scale.
- Supabase Postgres is good for MVP, but telemetry time-series at scale may need TimescaleDB.
- No Redis means live vehicle state is read from database instead of ultra-fast memory cache.

---

## 6. Future Architecture Choices

### 6.1 When To Add MQTT Or Streaming Queue

Add MQTT/streaming when:

- telemetry arrives every 2-3 seconds from many vehicles,
- REST writes become too slow,
- ingestion needs retries/backpressure,
- multiple consumers need the same telemetry stream,
- real-time alerting latency becomes critical.

Future flow:

```text
Evify devices
    -> MQTT broker / Kafka / managed queue
    -> telemetry consumer
    -> TimescaleDB + Redis
    -> model and alert workers
```

### 6.2 When To Add TimescaleDB

Add TimescaleDB when:

- telemetry rows become very large,
- time-window queries slow down,
- retention/downsampling is needed,
- analytics need time-series partitioning.

Current Supabase Postgres is okay for MVP and demo.

### 6.3 When To Add Redis

Add Redis when:

- dashboard needs sub-second live vehicle state,
- alert engine needs fast rolling windows,
- current DB polling becomes expensive,
- WebSocket live updates are added.

Current DB reads are okay for demo.

### 6.4 When To Add Background Workers

Add Celery/RQ/Arq workers when:

- file imports are large,
- retraining jobs run from the backend,
- external API calls need retries,
- alert/nudge delivery becomes async,
- model evaluation jobs become scheduled.

### 6.5 Model Versioning Choice

Current:

- V4.1 is production.
- V5-A is candidate.

Future:

- Add model version table.
- Store model artifact metadata.
- Store evaluation metrics per dataset.
- Promote only when candidate beats production on stable validation.

---

## 7. Immediate Next Steps

1. Connect frontend to all existing backend endpoints.
2. Deploy backend on Render with Supabase Postgres.
3. Deploy frontend on Vercel.
4. Run smoke tests on live URLs.
5. Ask Evify/frontend/order source for:
   - real order IDs
   - restaurant/customer locations
   - prep estimates
   - pickup/handover timestamps
   - delivery completion timestamps
6. Start collecting live outcome data in:
   - `wait_events`
   - `order_assignment_decisions`
   - `charging_decision_records`
   - `nudge_events`
   - `driver_behavior_snapshots`
   - `trips`
7. After enough data, retrain and evaluate V5-A.
8. Only after stable multi-driver history, start V6 driver embedding work.

---

## 8. Final Product Position

Current Trickee is not just a battery prediction API. It is becoming an EV delivery intelligence layer:

- predicts battery/range using V4.1,
- understands driver behavior,
- detects useful vs useless wait time,
- assigns orders based on SOC/range/wait,
- chooses charging strategy during delivery workflow,
- stores outcomes for future learning.

The current backend is demo-ready and learning-ready. The next unlock is real operational data, especially order lifecycle and nudge/charging outcomes.
