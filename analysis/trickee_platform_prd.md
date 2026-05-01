# Trickee EV Intelligence Platform — Product Requirements Document (PRD)
**Version:** 1.0  
**Date:** April 2026  
**Team:** 2 Engineers  
**Purpose:** Full-stack MVP web application to demonstrate Trickee's AI-driven EV fleet intelligence to Evify  
**Stack:** Next.js 14 (App Router) + FastAPI (Python) + PostgreSQL + NextAuth.js  
**Current deployment decision:** Vercel Free frontend + Render Free backend + Supabase Free Postgres. Railway remains a paid fallback, not the primary MVP path.  
**This document is the single source of truth. No other document is needed to build this product.**

---

## 1. Product Overview

### 1.1 What We Are Building
A full-stack web application with role-based authentication that showcases Trickee's AI-driven EV fleet intelligence platform to the Evify team. The platform demonstrates:

1. **Live LSTM AI inference** — predicts next 5-minute SOC and dynamic range in km per vehicle
2. **Fleet operator intelligence** — all vehicles, all drivers, health metrics, alerts
3. **Driver personalization** — per-driver range, nudge, style score, trip history
4. **Route intelligence** — multi-route comparison, departure nudge, dynamic rerouting
5. **Opportunistic charging alerts** — smart push when vehicle is parked and SOC is low
6. **Smart order + wait intelligence** - assign orders using SOC/range/wait, classify wait type, and choose charging option A/B/C

All vehicle telemetry, driver IDs, and GPS coordinates use **synthetic but physics-accurate data** generated to reflect real Surat urban fleet conditions.

> *Footnote to show on all screens:* "Driver IDs, GPS coordinates, and trip data are synthetic but physics-accurate, generated to reflect real Surat urban fleet conditions. Live integration is available upon API handshake with Evify's telemetry stream."

### 1.2 Target Demo Audience
- Evify CTO / Tech Lead
- Evify Fleet Operations Manager
- Evify Driver (simulated, to show the driver-facing product)

### 1.3 Success Criteria
- All 3 user roles can log in and see role-appropriate dashboards
- LSTM AI inference runs live and shows predicted SOC + dynamic range in km
- Route intelligence and nudge engine shows personalized recommendations
- The UI looks and feels like a production-grade product (not a Streamlit prototype)
- A one-line synthetic data disclaimer appears on data-heavy screens

---

## 2. Tech Stack — Precise Versions

| Layer | Technology | Version |
|---|---|---|
| Frontend framework | Next.js (App Router) | 14.x |
| Frontend language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| Charts | Recharts | 2.x |
| Authentication | NextAuth.js | 4.x |
| Backend framework | FastAPI | 0.110.x |
| Backend language | Python | 3.11 |
| AI model | PyTorch (existing LSTM) | 2.2.x |
| Database | PostgreSQL | 15.x |
| ORM | SQLAlchemy + Alembic | 2.x |
| Password hashing | bcrypt | — |
| API communication | REST (JSON) | — |
| HTTP client (frontend) | fetch / axios | — |
| Environment management | .env.local (Next.js) + .env (FastAPI) | — |

---

## 3. Repository Structure

```
trickee-platform/
├── frontend/                    ← Next.js app (Dev 2 owns entirely)
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx       ← Sidebar + topbar shell
│   │   │   ├── fleet/
│   │   │   │   └── page.tsx     ← Fleet Operator: all vehicles
│   │   │   ├── vehicle/
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx ← Per-vehicle predictive AI view
│   │   │   ├── driver/
│   │   │   │   └── page.tsx     ← Driver personal view
│   │   │   ├── routes/
│   │   │   │   └── page.tsx     ← Route intelligence + nudge
│   │   │   ├── scorecards/
│   │   │   │   └── page.tsx     ← Fleet operator: driver scorecards
│   │   │   ├── alerts/
│   │   │   │   └── page.tsx     ← Charging alerts feed
│   │   │   └── admin/
│   │   │       └── page.tsx     ← Trickee admin: model metrics
│   │   └── api/
│   │       └── auth/
│   │           └── [...nextauth]/
│   │               └── route.ts ← NextAuth handler
│   ├── components/
│   │   ├── ui/                  ← Reusable base components
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Spinner.tsx
│   │   │   └── SyntheticBadge.tsx ← Footnote disclaimer component
│   │   ├── charts/
│   │   │   ├── SocLineChart.tsx
│   │   │   ├── RangeGaugeChart.tsx
│   │   │   ├── DriverRadarChart.tsx
│   │   │   └── EnergyBarChart.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Topbar.tsx
│   │   │   └── RoleGuard.tsx    ← Redirects if wrong role
│   │   ├── fleet/
│   │   │   ├── VehicleCard.tsx
│   │   │   └── FleetKpiBar.tsx
│   │   ├── vehicle/
│   │   │   ├── PredictiveKpiCards.tsx
│   │   │   ├── ContextWindow.tsx
│   │   │   ├── RangePenaltyBreakdown.tsx
│   │   │   └── StatusChip.tsx
│   │   ├── driver/
│   │   │   ├── DriverProfileCard.tsx
│   │   │   ├── NudgeCard.tsx
│   │   │   └── TripHistoryTable.tsx
│   │   ├── routes/
│   │   │   ├── RouteCompareCards.tsx
│   │   │   └── RerouteAlert.tsx
│   │   └── scorecards/
│   │       ├── DriverScorecardRow.tsx
│   │       └── ScoreGauge.tsx
│   ├── lib/
│   │   ├── api.ts               ← All fetch calls to FastAPI backend
│   │   ├── auth.ts              ← NextAuth config
│   │   └── utils.ts             ← Formatters, helpers
│   ├── types/
│   │   └── index.ts             ← All TypeScript interfaces
│   ├── public/
│   │   └── trickee-logo.svg
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   ├── .env.local               ← NEXTAUTH_SECRET, BACKEND_URL
│   └── package.json
│
├── backend/                     ← FastAPI app (Dev 1 owns entirely)
│   ├── app/
│   │   ├── main.py              ← FastAPI app entry, CORS, router registration
│   │   ├── config.py            ← Settings from .env
│   │   ├── database.py          ← SQLAlchemy engine + session
│   │   ├── models/              ← SQLAlchemy ORM models
│   │   │   ├── user.py
│   │   │   ├── vehicle.py
│   │   │   ├── driver.py
│   │   │   ├── telemetry.py
│   │   │   ├── trip.py
│   │   │   └── alert.py
│   │   ├── schemas/             ← Pydantic request/response schemas
│   │   │   ├── user.py
│   │   │   ├── vehicle.py
│   │   │   ├── driver.py
│   │   │   ├── telemetry.py
│   │   │   ├── prediction.py
│   │   │   └── route.py
│   │   ├── routers/             ← One file per feature domain
│   │   │   ├── auth.py          ← /api/v1/auth/*
│   │   │   ├── vehicles.py      ← /api/v1/vehicles/*
│   │   │   ├── drivers.py       ← /api/v1/drivers/*
│   │   │   ├── telemetry.py     ← /api/v1/telemetry/*
│   │   │   ├── predictions.py   ← /api/v1/predictions/*
│   │   │   ├── routes.py        ← /api/v1/routes/*
│   │   │   └── alerts.py        ← /api/v1/alerts/*
│   │   ├── services/            ← Business logic
│   │   │   ├── ai_engine.py     ← LSTM model loader + inference
│   │   │   ├── physics.py       ← Physics calculations (OCV, resistance, range)
│   │   │   ├── route_scorer.py  ← Multi-route composite scorer
│   │   │   ├── nudge_engine.py  ← Departure nudge generator
│   │   │   └── alert_service.py ← Charging alert logic
│   │   └── utils/
│   │       ├── auth.py          ← JWT create/verify, bcrypt
│   │       └── seed.py          ← Synthetic data seeder script
│   ├── models_ml/               ← ML model files (copied from existing work)
│   │   ├── battery_model_v4_1.pth
│   │   ├── scaler_v4_1.joblib
│   │   └── y_scaler_v4_1.joblib
│   ├── alembic/                 ← DB migrations
│   ├── .env
│   └── requirements.txt
│
└── README.md
```

---

### 3.1 Current MVP Backend Data Flow

The current production-grade MVP uses direct REST ingestion rather than MQTT/TimescaleDB/Redis:

```text
Evify JSON / live webhook
        ->
POST /api/v1/telemetry/evify or /api/v1/telemetry/evify/bulk
        ->
FastAPI normalization + physics feature computation
        ->
Postgres telemetry, trips, wait_events, alerts, predictions, and intelligence history tables
        ->
Dashboard APIs and V4.1 model inference
```

This is the right architecture for the current demo and frontend handoff because it is deployable on free cloud and keeps the API contract simple. The scale architecture remains a future upgrade:

```text
Evify Scooter -> MQTT broker -> consumer -> TimescaleDB history + Redis live state -> APIs/model services
```

Do not build the MQTT/TimescaleDB/Redis path until live telemetry volume requires it.

---

## 4. Database Schema

### 4.1 `users` table
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
email         VARCHAR(255) UNIQUE NOT NULL
password_hash VARCHAR(255) NOT NULL
full_name     VARCHAR(255) NOT NULL
role          VARCHAR(50) NOT NULL  -- 'trickee_admin' | 'fleet_operator' | 'driver'
fleet_id      UUID REFERENCES fleets(id) NULL  -- NULL for trickee_admin
driver_id     UUID REFERENCES drivers(id) NULL -- only for role=driver
is_active     BOOLEAN DEFAULT TRUE
created_at    TIMESTAMP DEFAULT NOW()
updated_at    TIMESTAMP DEFAULT NOW()
```

### 4.2 `fleets` table
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
name        VARCHAR(255) NOT NULL  -- e.g. "Evify Surat Fleet"
city        VARCHAR(100) NOT NULL
created_at  TIMESTAMP DEFAULT NOW()
```

### 4.3 `vehicles` table
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
fleet_id        UUID REFERENCES fleets(id) NOT NULL
vehicle_code    VARCHAR(50) UNIQUE NOT NULL  -- e.g. "GJ05PZ1903"
make            VARCHAR(100) NOT NULL         -- "Evify"
model           VARCHAR(100) NOT NULL         -- "S1 Pro"
battery_capacity_kwh  FLOAT NOT NULL          -- e.g. 3.0
max_range_km    FLOAT NOT NULL                -- e.g. 85.0
battery_chemistry VARCHAR(20) NOT NULL        -- "LFP"
manufacture_year INT NOT NULL
is_active       BOOLEAN DEFAULT TRUE
created_at      TIMESTAMP DEFAULT NOW()
```

### 4.4 `drivers` table
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
fleet_id              UUID REFERENCES fleets(id) NOT NULL
driver_code           VARCHAR(50) UNIQUE NOT NULL  -- e.g. "D047"
full_name             VARCHAR(255) NOT NULL
phone                 VARCHAR(20)
style_label           VARCHAR(50)   -- 'Aggressive' | 'Smooth' | 'Efficient' | 'Cautious'
personal_factor       FLOAT DEFAULT 1.1  -- how much longer than Google ETA they take
avg_regen_ratio       FLOAT DEFAULT 0.3  -- regen events / total steps
avg_throttle_variance FLOAT DEFAULT 0.2
avg_current_30m       FLOAT DEFAULT 5.0
avg_speed_30m         FLOAT DEFAULT 28.0
created_at            TIMESTAMP DEFAULT NOW()
```

### 4.5 `telemetry` table
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
vehicle_id        UUID REFERENCES vehicles(id) NOT NULL
driver_id         UUID REFERENCES drivers(id)
recorded_at       TIMESTAMP NOT NULL
soc               FLOAT NOT NULL          -- 0-100 %
current           FLOAT NOT NULL          -- Amps
battery_voltage   FLOAT NOT NULL          -- Volts
speed             FLOAT NOT NULL          -- km/h
temp_max          FLOAT NOT NULL          -- °C
soh               FLOAT NOT NULL          -- 0-100 %
charge_plug       BOOLEAN NOT NULL
ignition_on       BOOLEAN NOT NULL
regen_status      BOOLEAN NOT NULL
throttle_status   BOOLEAN NOT NULL
cycle_count       INT NOT NULL
cell_imbalance_mv FLOAT NOT NULL
lat               FLOAT                   -- Surat synthetic GPS
lng               FLOAT
-- Derived physics fields (computed and stored for performance)
power             FLOAT
power_density     FLOAT
temp_rise_rate    FLOAT
voltage_sag_v     FLOAT
r_internal_mohm   FLOAT
minute_of_day     INT
day_of_week       INT
```

### 4.6 `predictions` table
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
vehicle_id            UUID REFERENCES vehicles(id) NOT NULL
driver_id             UUID REFERENCES drivers(id)
predicted_at          TIMESTAMP DEFAULT NOW()
actual_soc            FLOAT NOT NULL
predicted_delta_soc   FLOAT NOT NULL
predicted_next_soc    FLOAT NOT NULL
true_next_soc         FLOAT             -- filled in after 5 min elapses
ai_error              FLOAT             -- abs(predicted - true)
dynamic_range_km      FLOAT NOT NULL
predicted_range_km    FLOAT NOT NULL
soh_factor            FLOAT NOT NULL
thermal_factor        FLOAT NOT NULL
aggression_factor     FLOAT NOT NULL
window_size           INT NOT NULL      -- how many timesteps fed to LSTM
```

### 4.7 `trips` table
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
vehicle_id      UUID REFERENCES vehicles(id) NOT NULL
driver_id       UUID REFERENCES drivers(id) NOT NULL
started_at      TIMESTAMP NOT NULL
ended_at        TIMESTAMP
origin_lat      FLOAT
origin_lng      FLOAT
dest_lat        FLOAT
dest_lng        FLOAT
origin_label    VARCHAR(255)        -- e.g. "Depot - Surat Ring Road"
dest_label      VARCHAR(255)        -- e.g. "Customer - Varachha"
soc_start       FLOAT
soc_end         FLOAT
kwh_used        FLOAT
distance_km     FLOAT
route_taken     VARCHAR(50)         -- 'A' | 'B' | 'C'
recommended_route VARCHAR(50)
followed_nudge  BOOLEAN
```

### 4.8 `alerts` table
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
vehicle_id      UUID REFERENCES vehicles(id) NOT NULL
driver_id       UUID REFERENCES drivers(id)
alert_type      VARCHAR(50) NOT NULL  -- 'low_soc_parked' | 'charging_opportunity' | 'reroute'
message         TEXT NOT NULL
soc_at_alert    FLOAT
nearest_charger VARCHAR(255)
charger_distance_m INT
is_resolved     BOOLEAN DEFAULT FALSE
created_at      TIMESTAMP DEFAULT NOW()
```

### 4.9 V5/V6 learning store tables

These tables support V5-A improvement, V5-D order/charging intelligence, and later V6 training. They are intentionally separate from V4.1 inference, so the production model remains stable while Trickee collects longitudinal behavior and outcome data.

```sql
driver_behavior_snapshots
- driver_id, computed_at, window_minutes, sample_count
- avg_current_30m, avg_speed_30m, regen_ratio_30m, throttle_var_30m, style_label

nudge_events
- driver_id, vehicle_id, alert_id, nudge_type, channel, message, payload
- status, outcome, acknowledged_at, created_at

order_assignment_decisions
- fleet_id, order_id, assigned_driver_id, strategy
- restaurant_wait_min, delivery_distance_km, required_range_km, assignment_score
- request_payload, result_payload, outcome, created_at

charging_decision_records
- driver_id, vehicle_id, order_id, chosen_option, message
- selected_charger, wait_window, request_payload, result_payload, outcome, created_at

wait_events
- vehicle_id, driver_id, started_at, ended_at, last_seen_at, wait_type
- source, ignition_on, charge_plug, lat, lng, duration_seconds, confidence
- restaurant_distance_m, charger_distance_m, context, created_at
```

---

## 5. Authentication & Authorization

### 5.1 Flow

Current production direction supports two login modes. Demo password login remains available for local demos. Firebase Auth is the preferred hosted identity provider once Firebase project keys are configured.

**Firebase mode:**
1. User visits `/login`
2. Frontend signs in with Firebase Auth
3. Frontend sends Firebase ID token to `POST /api/v1/auth/firebase-login`
4. Backend verifies the Firebase ID token with Firebase Admin SDK
5. Backend maps `firebase_uid` or email to the Trickee `users` table
6. Backend returns Trickee JWT access token with role/fleet/driver claims
7. NextAuth stores token in encrypted cookie
8. All protected API calls include `Authorization: Bearer <token>` header
9. FastAPI verifies Trickee JWT on every protected endpoint
10. On frontend, `RoleGuard` component checks role and redirects if unauthorized

**Demo password mode:**
1. User visits `/login`
2. Submits email + password
3. Frontend calls `POST /api/v1/auth/login` on FastAPI backend
4. Backend verifies password, returns JWT access token (expires 24h)
5. NextAuth stores token in encrypted cookie
6. All protected API calls include `Authorization: Bearer <token>` header
7. FastAPI verifies JWT on every protected endpoint
8. On frontend, `RoleGuard` component checks role and redirects if unauthorized

### 5.2 Seed Users (for demo)

| Email | Password | Role | Name |
|---|---|---|---|
| admin@trickee.ai | Trickee@2026 | trickee_admin | Arjun Mehta |
| fleet@evify.in | Evify@2026 | fleet_operator | Rajesh Kumar |
| driver1@evify.in | Driver@2026 | driver | Ravi Shah (D047) |
| driver2@evify.in | Driver@2026 | driver | Priya Nair (D051) |
| driver3@evify.in | Driver@2026 | driver | Karthik Raj (D033) |

### 5.3 Role-Based Access

| Route | trickee_admin | fleet_operator | driver |
|---|---|---|---|
| `/fleet` | ✅ all fleets | ✅ own fleet only | ❌ redirect |
| `/vehicle/[id]` | ✅ | ✅ own fleet | ❌ redirect |
| `/driver` | ✅ any driver | ❌ redirect | ✅ own profile only |
| `/routes` | ✅ | ✅ | ✅ own vehicle |
| `/scorecards` | ✅ | ✅ own fleet | ❌ redirect |
| `/alerts` | ✅ | ✅ own fleet | ✅ own alerts only |
| `/admin` | ✅ | ❌ redirect | ❌ redirect |

### 5.4 API Auth
- Every FastAPI endpoint except `/api/v1/auth/login` and `/api/v1/auth/firebase-login` requires Trickee JWT
- JWT payload: `{ sub: user_id, role: role, fleet_id: fleet_id, driver_id: driver_id, exp: timestamp }`
- FastAPI dependency: `get_current_user(token: str = Depends(oauth2_scheme))`
- Firebase UID is identity-only; Trickee roles still come from Postgres.
- FCM browser/device tokens are stored in `device_push_tokens`.

---

## 6. API Specification

**Base URL:** `http://localhost:8000/api/v1`  
**All responses follow this format:**
```json
{
  "success": true,
  "data": { ... },
  "message": "OK",
  "error": null
}
```

---

### 6.1 Auth Router (`/auth`)

#### `POST /auth/login`
**Body:**
```json
{ "email": "fleet@evify.in", "password": "Evify@2026" }
```
**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhb...",
    "token_type": "bearer",
    "user": {
      "id": "uuid",
      "email": "fleet@evify.in",
      "full_name": "Rajesh Kumar",
      "role": "fleet_operator",
      "fleet_id": "uuid"
    }
  }
}
```

#### `POST /auth/firebase-login`
**Body:**
```json
{ "id_token": "firebase-id-token" }
```
**Response:** same shape as `/auth/login`. Unknown Firebase users are rejected until mapped in the Trickee `users` table.

#### `POST /auth/fcm-token`
Registers a browser/device token for push alerts.

**Body:**
```json
{ "token": "fcm-token", "platform": "web", "device_label": "dashboard-browser" }
```

#### `GET /auth/me`
Returns current user from JWT. Used by frontend on app load.

#### `POST /auth/logout`
Invalidates session (client-side token deletion — stateless JWT, so just acknowledge).

---

### 6.2 Vehicles Router (`/vehicles`)

#### `GET /vehicles`
Returns all vehicles for the requester's fleet (fleet_operator sees own fleet; trickee_admin sees all).

**Response data:**
```json
[
  {
    "id": "uuid",
    "vehicle_code": "GJ05PZ1903",
    "make": "Evify",
    "model": "S1 Pro",
    "max_range_km": 85.0,
    "latest_telemetry": {
      "soc": 72.4,
      "speed": 34.2,
      "temp_max": 38.1,
      "soh": 91.2,
      "charge_plug": false,
      "ignition_on": true,
      "regen_status": false,
      "throttle_status": true,
      "status_tag": "Driving",
      "recorded_at": "2026-04-20T10:12:00Z"
    },
    "latest_prediction": {
      "dynamic_range_km": 61.4,
      "predicted_next_soc": 71.9,
      "predicted_range_km": 60.9
    }
  }
]
```

#### `GET /vehicles/{vehicle_id}`
Returns full detail for one vehicle including last 20 telemetry records (for context window graph).

#### `GET /vehicles/{vehicle_id}/telemetry`
Query params: `?limit=100&offset=0`  
Returns paginated telemetry records for one vehicle.

---

### 6.3 Predictions Router (`/predictions`)

#### `POST /predictions/infer`
Triggers live LSTM inference for a vehicle. Takes the latest 20 telemetry rows, runs the model, stores result in `predictions` table, returns result.

**Body:**
```json
{ "vehicle_id": "uuid" }
```

**Response data:**
```json
{
  "actual_soc": 72.4,
  "predicted_delta_soc": -0.52,
  "predicted_next_soc": 71.88,
  "true_next_soc": 71.9,
  "ai_error": 0.02,
  "dynamic_range_km": 61.4,
  "predicted_range_km": 60.9,
  "soh_factor": 0.912,
  "thermal_factor": 0.919,
  "aggression_factor": 0.876,
  "base_range_km": 85.0,
  "window_size": 20,
  "physics_features": {
    "temp_rise_rate": 0.04,
    "power_density": 0.142,
    "r_internal_mohm": 48.3
  }
}
```

#### `GET /predictions/{vehicle_id}/history`
Returns last 50 predictions for a vehicle (for the AI accuracy graph).

---

### 6.4 Drivers Router (`/drivers`)

#### `GET /drivers`
Fleet operator sees all drivers in their fleet. Trickee admin sees all. Driver role: 403.

**Response data:**
```json
[
  {
    "id": "uuid",
    "driver_code": "D047",
    "full_name": "Ravi Shah",
    "style_label": "Aggressive",
    "personal_factor": 1.136,
    "avg_regen_ratio": 0.18,
    "avg_throttle_variance": 0.42,
    "avg_current_30m": 8.4,
    "avg_speed_30m": 31.2,
    "current_vehicle": "GJ05PZ1903",
    "trips_this_week": 12,
    "kwh_used_this_week": 24.6,
    "efficiency_rank": 4,
    "efficiency_vs_fleet_pct": -18.3
  }
]
```

#### `GET /drivers/{driver_id}`
Full driver profile. Driver role can only access own ID.

#### `GET /drivers/{driver_id}/trips`
Trip history. Query params: `?limit=20&offset=0`

---

### 6.5 Routes Router (`/routes`)

#### `POST /routes/score`
Multi-route scorer. Takes driver_id + day_type + slot + soc_start. Returns ranked routes with nudge.

**Body:**
```json
{
  "driver_id": "uuid",
  "soc_start": 78.0,
  "day_type": "weekday",
  "slot": "morning",
  "origin_label": "Depot - Ring Road, Surat",
  "dest_label": "Customer - Varachha"
}
```

**Response data:**
```json
{
  "ranked_routes": [
    {
      "rank": 1,
      "route_id": "B",
      "route_name": "Route B - Althan Bypass",
      "distance_km": 9.8,
      "avg_speed_kmh": 34,
      "google_eta_min": 17.3,
      "personalized_eta_min": 19.6,
      "ev_kwh_used": 1.964,
      "soc_end_pct": 71.5,
      "range_remaining_km": 60.8,
      "composite_score": 0.5339,
      "is_ev_optimal": true,
      "stop_and_go_index": 0.30
    },
    {
      "rank": 2,
      "route_id": "A",
      "route_name": "Route A - Surat-Dumas Road",
      "distance_km": 8.5,
      "avg_speed_kmh": 22,
      "google_eta_min": 23.2,
      "personalized_eta_min": 26.3,
      "ev_kwh_used": 1.938,
      "soc_end_pct": 71.6,
      "range_remaining_km": 60.9,
      "composite_score": 0.6439,
      "is_ev_optimal": false,
      "stop_and_go_index": 0.55
    },
    {
      "rank": 3,
      "route_id": "C",
      "route_name": "Route C - Adajan Road",
      "distance_km": 10.2,
      "avg_speed_kmh": 28,
      "google_eta_min": 21.9,
      "personalized_eta_min": 24.8,
      "ev_kwh_used": 2.201,
      "soc_end_pct": 70.7,
      "range_remaining_km": 60.1,
      "composite_score": 0.7032,
      "is_ev_optimal": false,
      "stop_and_go_index": 0.45
    }
  ],
  "departure_nudge": {
    "desired_arrival": "09:00",
    "recommended_departure": "08:30",
    "buffer_min": 10,
    "traffic_decay_ratio": 0.68,
    "alert_level": "HIGH_TRAFFIC_DECAY",
    "message": "Based on your past 8 Tuesday trips, you take ~2.3 min longer than Google Maps. Leave by 08:30 via Althan Bypass to arrive by 09:00."
  }
}
```

#### `POST /routes/reroute`
Dynamic rerouting. Takes current vehicle state + incident info.

**Body:**
```json
{
  "vehicle_id": "uuid",
  "driver_id": "uuid",
  "incident_route_id": "A",
  "incident_type": "traffic_jam",
  "current_soc": 65.0,
  "day_type": "weekday",
  "slot": "morning"
}
```

**Response data:**
```json
{
  "trigger": "⚠ Jam detected on Route A - Surat-Dumas Road",
  "incident_speed_kmh": 8,
  "original_route_eta_min": 68.4,
  "recommended_reroute": "Route B - Althan Bypass",
  "reroute_eta_min": 19.6,
  "time_saved_min": 48.8,
  "soc_after_reroute": 58.4,
  "message": "Switch to Althan Bypass to save ~48.8 min. Battery will land at 58.4%."
}
```

---

### 6.6 Alerts Router (`/alerts`)

#### `GET /alerts`
Returns all unresolved alerts for the current user's scope (driver sees own, fleet_op sees fleet).

**Response data:**
```json
[
  {
    "id": "uuid",
    "vehicle_code": "GJ05PZ1903",
    "driver_name": "Ravi Shah",
    "alert_type": "charging_opportunity",
    "message": "Vehicle parked for 9 min. SOC at 22%. Nearest charger: Surat Smart Charge Hub, 180m away. Plug in now to gain ~23 km before next delivery.",
    "soc_at_alert": 22.1,
    "nearest_charger": "Surat Smart Charge Hub",
    "charger_distance_m": 180,
    "is_resolved": false,
    "created_at": "2026-04-20T10:08:00Z"
  }
]
```

#### `POST /alerts/{alert_id}/resolve`
Marks an alert as resolved.

---

### 6.7 Intelligence Router (`/intelligence`)

These endpoints implement the April 23 order/wait/charging architecture and the V5/V6 learning-store foundation.

#### `GET /intelligence/drivers/{driver_id}/behavior`
Computes rolling driver behavior metrics over recent telemetry and can persist a `driver_behavior_snapshots` row.

#### `POST /intelligence/context`
Returns route context for origin/destination using optional external APIs with deterministic fallbacks.

#### `POST /intelligence/wait-time`
Estimates the order wait/charging window and classifies the current wait type.

**Body:**
```json
{
  "driver_location": { "lat": 21.1701, "lng": 72.8310 },
  "restaurant_location": { "lat": 21.1701, "lng": 72.8310 },
  "prep_min": 12,
  "handover_buffer_min": 2,
  "current_speed_kmph": 0,
  "ignition_on": true,
  "charge_plug": false,
  "current_stop_duration_min": 5
}
```

**Response data includes:**
```json
{
  "travel_min": 0.0,
  "prep_min": 12.0,
  "handover_buffer_min": 2.0,
  "observed_stop_min": 5.0,
  "total_window_min": 14.0,
  "chargeable_min": 19.0,
  "wait_type": "restaurant_wait",
  "useful_for_charging": true
}
```

Wait type rules:
- `restaurant_wait`: speed near zero and inside restaurant/order geofence.
- `traffic_wait`: speed near zero, ignition ON, away from restaurant/charger.
- `idle_wait`: stationary away from restaurant/charger with ignition OFF.
- `charging_wait`: charge plug/status or charger proximity.

Evify does not provide computed wait time. Evify provides raw GPS, speed, ignition, SOC, and charge status; Trickee calculates wait intelligence.

#### `POST /intelligence/orders/assign`
Ranks available drivers for an order. If restaurant wait is long enough, low-SOC drivers with safe range are favored so they can use wait time for charging.

#### `POST /intelligence/charging/decision`
Evaluates:
- Option A: charge near restaurant during wait.
- Option B: detour to charger before pickup.
- Option C: deliver directly.

#### History endpoints
- `GET /intelligence/history/driver-behavior`
- `GET /intelligence/history/nudges`
- `GET /intelligence/history/order-assignments`
- `GET /intelligence/history/charging-decisions`
- `GET /intelligence/history/waits`

---

### 6.8 Admin Router (`/admin`) - trickee_admin only

#### `GET /admin/metrics`
Returns AI model performance statistics.

**Response data:**
```json
{
  "model_version": "V4.1",
  "mae_soc_units": 0.412,
  "rmse_soc_units": 0.5648,
  "accuracy_within_1pct": 92.62,
  "accuracy_within_3pct": 99.75,
  "model_parameters": 135169,
  "total_predictions_served": 4821,
  "avg_inference_latency_ms": 48,
  "training_vehicles": 12,
  "test_vehicles": 4,
  "features_used": 20
}
```

#### `GET /admin/users`
Returns all users across all fleets.

---

## 7. Frontend Screens — Detailed Specification

### 7.1 Login Page (`/login`)

**Layout:** Full-screen centered card, dark background with subtle gradient.

**Elements:**
- Trickee logo (top center)
- Title: "EV Intelligence Platform"
- Subtitle: "Sign in to your account"
- Email input field
- Password input field
- "Sign In" button (primary, full-width)
- Error message display (invalid credentials)
- Loading spinner on submit

**Behaviour:**
- On success: redirect to `/fleet` (fleet_operator), `/driver` (driver), `/admin` (trickee_admin)
- On error: show inline error "Invalid email or password"

**Design:** Dark mode (#0d1117 background, #161b22 card, teal accent #00b4d8)

---

### 7.2 Dashboard Shell (`app/(dashboard)/layout.tsx`)

**Layout:** Fixed sidebar left (220px) + topbar top (60px) + scrollable main content

**Sidebar items by role:**

| Icon | Label | Route | Visible to |
|---|---|---|---|
| 🗺 | Fleet Overview | `/fleet` | admin, fleet_op |
| 🔋 | AI Predictions | `/vehicle/[id]` | all |
| 👤 | My Profile | `/driver` | driver, admin |
| 🛣 | Route Intelligence | `/routes` | all |
| 📊 | Driver Scorecards | `/scorecards` | admin, fleet_op |
| 🔔 | Alerts | `/alerts` | all |
| ⚙️ | Model Metrics | `/admin` | admin only |

**Topbar:** Trickee logo left, current page title center, user avatar + name right, logout button.

---

### 7.3 Fleet Overview (`/fleet`) — fleet_operator + trickee_admin

**Top KPI Bar (4 metrics):**
- Total Vehicles Active
- Average Fleet SOC %
- Vehicles Below 20% SOC (warning)
- Vehicles Currently Charging

**Vehicle Grid:** Responsive grid of `VehicleCard` components (2 cols on tablet, 3 on desktop)

**VehicleCard shows:**
- Vehicle code (e.g. "GJ05PZ1903")
- Status chip: `Charging 🔌` / `Driving 🏃` / `Regen ♻️` / `Idling 🛑` — color coded
- SOC % (large, color: green >50%, amber 20-50%, red <20%)
- Dynamic Range: e.g. "61.4 km"
- Driver name
- Last updated timestamp
- Click → navigates to `/vehicle/[id]`

**Synthetic data disclaimer at bottom of page.**

---

### 7.4 Vehicle Predictive AI View (`/vehicle/[id]`) — fleet_operator + trickee_admin

This is the core AI screen. Renders the LSTM inference output.

**Auto-refreshes every 30 seconds** (calls `POST /predictions/infer` silently).

**Section 1 — 4 KPI Cards:**
- Card 1: "Dynamic Range (Now)" — `{dynamic_range_km} km` in teal. Sub-text: "BMS says {nominal_range} km (+{gap} km lie)"
- Card 2: "AI Predicted Shift (5m)" — `{pred_delta:+.2f}%` in magenta. Sub-text: "SOC: {actual_soc}% → {predicted_next_soc}%"
- Card 3: "Predicted Range (After 5m)" — `{predicted_range_km} km` in magenta. Sub-text: "Physics-Adjusted"
- Card 4: "Ground Truth (Verification)" — `{true_next_soc}%` in green. Sub-text: "True Range: {true_range_km} km | AI Δ: {error}%"

**Section 2 — Range Penalty Breakdown (expandable):**
- 3 metrics: Battery Health (SOH%), Thermal Penalty (%), Aggression Penalty (%)
- Info box: "BMS says X km. Physics says Y km. Gap: Z km of range anxiety."

**Section 3 — 100-Minute Context Graph:**
- Line chart: X axis = time, Y axis = SOC %
- Solid teal line: historical 100 min window
- Dashed magenta line: AI prediction point (future 5 min)
- Green hollow circle: Ground truth point

**Section 4 — Context Features:**
- 3 metrics: Thermal Momentum (°C/min), Motor Load Stress (kW/kWh), Pack Resistance (mΩ)

**Section 5 — V5 Roadmap (collapsible):**
Static table: OpenWeatherMap / Elevation API / Traffic API with their range impact.

**Synthetic data disclaimer.**

---

### 7.5 Driver Personal View (`/driver`) — driver role (own data only)

**Section 1 — Driver Profile Card:**
- Name, driver code, style label (badge: Aggressive / Smooth / Efficient / Cautious)
- Personal factor: "You take 13.6% longer than Google Maps on average"
- Regen ratio, avg speed, avg current

**Section 2 — Today's Nudge Card:**
Prominent highlighted card:
> "🔔 Today's Departure Recommendation"  
> Route: **Althan Bypass (Route B)**  
> Leave by: **08:30**  
> Arrive by: **09:00**  
> "Based on your past 8 Tuesday trips, you take ~2.3 min extra. Traffic decay at 68% — buffer increased to 25 min."  
> Battery: 78% → 71.5% (60.8 km range remaining)

**Section 3 — Your Vehicle Status:**
Mini version of vehicle KPI cards (SOC, range, status).

**Section 4 — Trip History Table:**
Last 10 trips. Columns: Date, Origin→Dest, Route Taken, Recommended Route, Followed Nudge (✅/❌), kWh Used, SOC Start→End

**Synthetic disclaimer.**

---

### 7.6 Route Intelligence (`/routes`) — all roles

**Input Form (top):**
- Driver selector (fleet_op/admin can pick any driver; driver is auto-set to self)
- Day type toggle: Weekday / Weekend
- Time slot: Morning / Evening / Brunch / Night
- SOC start (slider: 0–100%)
- "Get Route Recommendation" button

**Output Section 1 — 3 Route Cards:**
Each card shows: Route name, Distance, Avg Speed, Personalized ETA, kWh Used, SOC End, Range Left, Composite Score. Cards ranked 1st/2nd/3rd. 1st card highlighted in teal.

**Output Section 2 — EV Energy Bar Chart:**
Horizontal bar chart comparing kWh consumption across routes.

**Output Section 3 — Departure Nudge:**
Same nudge card as in Driver view.

**Output Section 4 — Dynamic Rerouting Simulator:**
- Button: "Simulate Jam on Route A"
- On click: calls `/routes/reroute`, shows before/after comparison

**Synthetic disclaimer.**

---

### 7.7 Driver Scorecards (`/scorecards`) — fleet_operator + trickee_admin

**Top Filters:** Fleet selector (admin only), time period (This Week / This Month)

**Scorecard Table:**

| # | Driver | Style | Trips | kWh/km | vs Fleet Avg | Regen % | Followed Nudges | Efficiency Score |
|---|---|---|---|---|---|---|---|---|
| 1 🥇 | Priya Nair (D051) | Efficient | 14 | 0.189 | -8.2% | 41% | 85% | 92 |
| 2 | Karthik Raj (D033) | Smooth | 11 | 0.201 | -2.4% | 33% | 78% | 84 |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |
| 5 🔴 | Ravi Shah (D047) | Aggressive | 12 | 0.241 | +18.3% | 18% | 42% | 54 |

Click on a driver row → opens Driver Detail panel (right side drawer):
- Radar chart: 5 dimensions (Speed control, Regen usage, Throttle smoothness, Nudge compliance, Energy efficiency)
- "What's costing this driver range" insights list

---

### 7.8 Alerts (`/alerts`) — all roles (filtered by scope)

**Alert Feed** (reverse chronological):

Each alert card shows:
- 🔵 Type badge: `Charging Opportunity` / `Low SOC` / `Reroute`
- Vehicle code + Driver name
- Message (full text)
- Nearest charger + distance (if applicable)
- SOC at time of alert
- Timestamp
- "Mark Resolved" button → calls `PATCH /alerts/{id}/resolve`

**Fleet operators see all fleet alerts. Drivers see only their own alerts.**

---

### 7.9 Trickee Admin (`/admin`) — trickee_admin only

**Section 1 — Model Performance Card:**
- Large MAE display: "0.41% SOC" — highlighted
- Accuracy within ±1%: 92.62% — progress bar
- Accuracy within ±3%: 99.75% — progress bar
- Model parameters: 135,169
- Total predictions served
- Avg inference latency (ms)
- Training setup: GroupShuffleSplit (trained on 12 vehicles, blind test on 4)

**Section 2 — User Management Table:**
All users across all fleets. Columns: Name, Email, Role, Fleet, Status (Active/Inactive), Created. Actions: Activate/Deactivate.

---

## 8. Synthetic Data Specification

### 8.1 Fleet Setup
- 1 fleet: "Evify Surat Fleet"
- 8 vehicles: GJ05PZ1901 through GJ05PZ1908
- 5 drivers: D033, D041, D047, D051, D058
- Each driver assigned to 1–2 vehicles

### 8.2 Driver Profiles (5 distinct styles)

| Driver Code | Name | Style | Personal Factor | Regen Ratio | Throttle Variance | Efficiency Rank |
|---|---|---|---|---|---|---|
| D051 | Priya Nair | Efficient | 1.04× | 0.41 | 0.08 | 1 |
| D033 | Karthik Raj | Smooth | 1.08× | 0.33 | 0.14 | 2 |
| D041 | Meena Iyer | Cautious | 1.12× | 0.28 | 0.21 | 3 |
| D058 | Arjun Patel | Moderate | 1.15× | 0.24 | 0.31 | 4 |
| D047 | Ravi Shah | Aggressive | 1.136× | 0.18 | 0.42 | 5 |

### 8.3 Telemetry
- 500 rows per vehicle in DB
- Timestamps: last 48 hours in 5-minute intervals
- Built using the same logic as `generate_synthetic_evify.py` (existing file in the project)
- GPS: Surat city bounding box — lat: 21.14–21.22, lng: 72.81–72.92

### 8.4 Surat Route Definitions (replaces Coimbatore from interview)

| Route | Name | Distance | Signals | SAG | Driver Pref |
|---|---|---|---|---|---|
| A | Surat-Dumas Road | 8.5 km | 11 | 0.55 | 0.55 |
| B | Althan Bypass | 9.8 km | 6 | 0.30 | 0.85 |
| C | Adajan Road | 10.2 km | 8 | 0.45 | 0.50 |

### 8.5 Synthetic Charger Locations (Surat)

| Name | Lat | Lng | Type |
|---|---|---|---|
| Surat Smart Charge Hub | 21.1702 | 72.8311 | Fast (7.4kW) |
| Althan CPO Station | 21.1895 | 72.8604 | Fast (7.4kW) |
| Varachha Evify Depot | 21.2104 | 72.8789 | Slow (3.3kW) |
| Adajan Mall Charging | 21.1543 | 72.8001 | Fast (7.4kW) |

---

## 9. AI Engine Integration (Backend)

### 9.1 Model Files Location
```
backend/models_ml/
├── battery_model_v4_1.pth    ← Trained LSTM weights
├── scaler_v4_1.joblib        ← Feature scaler
└── y_scaler_v4_1.joblib      ← Target scaler
```

### 9.2 Inference Flow (`services/ai_engine.py`)
```python
# On app startup — load once, keep in memory
model = load_model("models_ml/battery_model_v4_1.pth")
scaler = joblib.load("models_ml/scaler_v4_1.joblib")
y_scaler = joblib.load("models_ml/y_scaler_v4_1.joblib")

# On each inference call
def infer(vehicle_id: str, db: Session) -> PredictionResult:
    # 1. Fetch last 20 telemetry rows ordered by recorded_at DESC
    rows = db.query(Telemetry).filter_by(vehicle_id=vehicle_id)
              .order_by(desc(Telemetry.recorded_at)).limit(20).all()
    
    # 2. Compute physics features for each row (same as train_model_v4.1.py)
    features_df = compute_physics_features(rows)
    
    # 3. Scale features
    X_scaled = scaler.transform(features_df[FEATURE_COLS])
    
    # 4. Reshape to (1, 20, 20) for LSTM
    X_tensor = torch.tensor(X_scaled).unsqueeze(0).float()
    
    # 5. Inference
    with torch.no_grad():
        pred_scaled = model(X_tensor).numpy()
    pred_delta = y_scaler.inverse_transform(pred_scaled)[0][0]
    
    # 6. Compute range with physics formula
    cur_row = rows[0]  # most recent
    actual_soc = cur_row.soc
    predicted_next_soc = actual_soc + pred_delta
    
    soh_factor = cur_row.soh / 100.0
    thermal_factor = 1.0 - max(0.0, (cur_row.temp_max - 30.0) / 100.0)
    aggression_factor = 1.0 - min(0.25, cur_row.power_density * 1.8)
    dynamic_range_km = 85.0 * soh_factor * thermal_factor * aggression_factor
    
    return PredictionResult(...)
```

### 9.3 FEATURE_COLS (must match training exactly - 20 input features in this order)
Important contract: `delta_soc` is the model target/output only. It must never be sent by Evify, stored as a telemetry input, or included in the inference feature matrix.

```python
FEATURE_COLS = [
    'soc', 'current', 'battery_voltage', 'soh', 'power', 'speed',
    'ignstatus', 'allow_charging', 'regen_status', 'throttle_status',
    'cell_temperature_01', 'temp_rise_rate', 'cycle_count',
    'cell_imbalance_mv', 'wh_throughput', 'r_internal_mohm',
    'voltage_sag_v', 'power_density', 'minute_of_day', 'day_of_week'
]
```

### 9.4 Physics Feature Computation
Copy verbatim from `aicodeold/model_training/v4/train_model_v4.1.py`:
- `compute_ocv(soc)` — LFP OCV lookup curve
- `compute_r_internal(cycle_count, soh)` — internal resistance
- `compute_voltage_sag(soc, voltage)` — OCV − terminal voltage
- `compute_power(voltage, current)` — W
- `compute_power_density(power, capacity_wh)` — kW/kWh
- `compute_temp_rise_rate(temp_series)` — dT/dt rolling

---

## 10. Route Scorer & Nudge Engine (Backend)

Port directly from `interview/route_intelligence.py`. Adapt for Surat routes.

### 10.1 Route Scorer (`services/route_scorer.py`)
```python
# Composite score formula (same as interview)
score = 0.40 * (T_pers / 50.0) + 0.35 * (E_kwh / 2.0) + 0.25 * (1 - P_pref)
# Lower = better

# Energy formula (same as interview, with all 3 braking penalties)
E = BASE_RATE * distance * (1 + smooth_sag_penalty + junction_penalty + speed_breaker_penalty) * speed_factor
```

### 10.2 Nudge Engine (`services/nudge_engine.py`)
```python
# Traffic decay
decay_ratio = current_speed / FREE_FLOW_SPEED  # 50.0 km/h
buffer_min = 25 if decay_ratio < 0.75 else 10

# Departure time
depart_time = desired_arrival - personalized_eta - buffer_min

# Personalized message uses driver.personal_factor and driver.full_name
```

### 10.3 Alert Service (`services/alert_service.py`)
```python
# Check on every telemetry insert:
if not ignition_on and speed < 3 and soc < 25:
    parked_duration = compute_parked_time(vehicle_id)
    if parked_duration > 5:  # minutes
        nearest = find_nearest_charger(lat, lng, CHARGER_DB)
        create_alert(type='charging_opportunity', ...)
```

---

## 11. Environment Variables

### Frontend (`.env.local`)
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<random-secure-string-32-chars>
BACKEND_URL=http://localhost:8000
```

### Backend (`.env`)
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/trickee_db
SECRET_KEY=<random-secure-string-32-chars>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
ALLOWED_ORIGINS=http://localhost:3000
```

---

## 12. Setup Instructions

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head       # runs all DB migrations
python -m app.utils.seed   # seeds all synthetic data + users
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                # runs on localhost:3000
```

---

## 13. Design System

### Colors
```css
--bg-primary:    #0d1117   /* Page background */
--bg-card:       #161b22   /* Card background */
--bg-border:     #30363d   /* Card borders */
--accent-teal:   #00b4d8   /* Primary accent, SOC values, range */
--accent-magenta:#ff00ff   /* AI prediction values */
--accent-green:  #3fb950   /* Ground truth, success */
--accent-amber:  #d29922   /* Warnings (20–50% SOC) */
--accent-red:    #f85149   /* Critical (<20% SOC) */
--text-primary:  #e6edf3
--text-dim:      #8b949e
```

### Typography
- Font: Inter (via Google Fonts)
- Page title: 24px bold
- Section title: 18px semibold
- KPI value: 36px bold
- KPI label: 12px medium, uppercase, dim color
- Body: 14px regular

### Component Rules
- All cards: `bg-card`, `border border-border`, `rounded-xl`, `p-6`
- All KPI values: monospace font
- Status chips: rounded-full badge with appropriate background
- All tables: striped rows, sticky header

---

## 14. Team Task Split (Zero Merge Conflicts)

The codebase is split into two fully independent directories:
- `frontend/` — owned entirely by **Developer 2**
- `backend/` — owned entirely by **Developer 1**

Neither developer touches the other's directory. The only shared contract is the API specification in Section 6 and the TypeScript interfaces in `frontend/types/index.ts` (also owned by Dev 2, but reflects the API schema Dev 1 builds).

One important thing in there: the seed script guard matters because Render runs migrations + seed on every container start, so the guard `if db.query(User).count() > 0: return` prevents wiping demo data on every deploy. Dev 1 needs to keep that.

---

### Developer 1 — Backend + AI (owns `backend/`)

**Week 1:**
- [ ] Set up FastAPI project structure (all folders, `main.py`, `config.py`)
- [ ] Set up PostgreSQL database + SQLAlchemy models (Section 4 - core tables plus V5/V6 learning-store tables)
- [ ] Alembic migrations for all tables
- [ ] Auth system: JWT creation/verification, bcrypt password hashing (`utils/auth.py`)
- [ ] Auth router: `POST /auth/login`, `GET /auth/me` (Section 6.1)
- [ ] Seed script: create fleet, vehicles, drivers, users, telemetry (Section 8)
- [ ] Copy ML model files from existing project into `backend/models_ml/`
- [ ] AI engine service: load model on startup, inference function (Section 9)
- [ ] Physics feature computation (Section 9.4 — copy from train_model_v4.1.py)
- [ ] Predictions router: `POST /predictions/infer`, `GET /predictions/{id}/history` (Section 6.3)

**Week 2:**
- [ ] Vehicles router: all endpoints (Section 6.2)
- [ ] Drivers router: all endpoints (Section 6.4)
- [ ] Route scorer service (Section 10.1)
- [ ] Nudge engine service (Section 10.2)
- [ ] Routes router: `POST /routes/score`, `POST /routes/reroute` (Section 6.5)
- [ ] Alert service logic (Section 10.3)
- [ ] Alerts router: all endpoints (Section 6.6)
- [ ] Admin router: model metrics, user management (Section 6.8)
- [ ] CORS configuration (`ALLOWED_ORIGINS` from env)
- [ ] Test every endpoint with Postman / FastAPI Swagger UI

**Deliverable to Dev 2 at end of Week 1:** Running API at `localhost:8000` with auth working and `/vehicles` returning real synthetic data.

---

### Developer 2 — Frontend (owns `frontend/`)

**Week 1:**
- [ ] Set up Next.js 14 project with TypeScript + Tailwind CSS
- [ ] Configure `tailwind.config.ts` with design system colors (Section 13)
- [ ] Set up NextAuth with JWT provider (Section 5.1)
- [ ] Build all base UI components (Section — `ui/` folder): Card, Badge, Button, Table, Spinner, SyntheticBadge
- [ ] Build Login page (Section 7.1) — wires up to `POST /auth/login`
- [ ] Build Dashboard shell: Sidebar + Topbar + RoleGuard (Section 7.2)
- [ ] Define all TypeScript interfaces in `types/index.ts` based on Section 6 API responses
- [ ] Set up `lib/api.ts` with all fetch functions (one per API endpoint)
- [ ] Build Fleet Overview page (Section 7.3) — VehicleCard, FleetKpiBar components
- [ ] Build chart components: SocLineChart, RangeGaugeChart (Section — `charts/` folder)

**Week 2:**
- [ ] Build Vehicle Predictive AI page (Section 7.4) — all 5 sections, auto-refresh every 30s
- [ ] Build Range Penalty Breakdown expandable section
- [ ] Build Driver Personal View page (Section 7.5)
- [ ] Build NudgeCard component
- [ ] Build Route Intelligence page (Section 7.6) — form + route cards + EV energy chart + rerouting simulator
- [ ] Build Driver Scorecards page (Section 7.7) — table + radar chart + drawer
- [ ] Build Alerts page (Section 7.8) — alert feed + resolve button
- [ ] Build Admin page (Section 7.9) — model metrics + user table
- [ ] Add SyntheticBadge disclaimer to all data-heavy pages
- [ ] Final polish: responsive layout, loading states, error states

**Note for Dev 2 Week 1:** Use mock/hardcoded data for all pages until Dev 1 delivers the API at end of Week 1. Then switch `lib/api.ts` to hit real endpoints.

---

### Merge Strategy
```bash
# Dev 1 works on: backend/ branch → backend-dev
# Dev 2 works on: frontend/ branch → frontend-dev

# Week 1 end: both merge to main (zero conflict — different directories)
git checkout main
git merge backend-dev    # touches only backend/
git merge frontend-dev   # touches only frontend/  ← NO CONFLICT

# Week 2 end: same pattern
git merge backend-dev
git merge frontend-dev
```

---

## 15. Deployment

### 15.1 Platform Choices

Primary MVP path uses free cloud services:

| Layer | Platform | Why | Free Tier |
|---|---|---|---|
| **Frontend** | Vercel | Native Next.js hosting, CDN, auto HTTPS | Yes |
| **Backend API** | Render Web Service | Docker-based Python/FastAPI deployment with free web service option | Yes |
| **Database** | Supabase Postgres | Persistent hosted Postgres on a free tier; better for MVP continuity than expiring demo DBs | Yes |
| **ML model files** | Bundled in backend repo | Checked into `production/backend/models_ml/`; no separate model hosting needed | Yes |

Railway is no longer the primary path because the project requirement is free cloud deployment. Railway remains a paid fallback if the team later wants a single platform for backend plus database.

---

### 15.2 Backend Deployment - Render

Use the repo-level `render.yaml` blueprint. It deploys `production/backend` as a Docker web service and runs the backend health check at `/health`.

Required Render environment variables:

```text
DATABASE_URL                  = Supabase pooled/direct Postgres URL
SECRET_KEY                    = generated by Render or a 32+ byte secret
ALGORITHM                     = HS256
ACCESS_TOKEN_EXPIRE_MINUTES   = 1440
ALLOWED_ORIGINS               = https://trickee-platform.vercel.app
MODEL_DIR                     = models_ml
DEMO_SEED                     = true
OPENWEATHER_API_KEY           = optional
GOOGLE_MAPS_API_KEY           = optional
GOOGLE_PLACES_API_KEY         = optional
EXTERNAL_API_TIMEOUT_SECONDS  = 6
NOTIFICATION_PROVIDER         = dashboard
```

For Supabase URLs, append `?sslmode=require` when using a direct Postgres URL that requires SSL.

Render starts the Docker container with:

```bash
alembic upgrade head && python -m app.utils.seed && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

The seed script must keep its guard so deploy restarts do not wipe demo data:

```python
if db.query(User).count() > 0:
    print("DB already seeded. Skipping.")
    return
```

---

### 15.3 Database Deployment - Supabase

1. Create a Supabase Free project.
2. Copy the Postgres connection string.
3. Use the pooled connection string for Render if available.
4. Set it as `DATABASE_URL` in Render.
5. Let the backend run `alembic upgrade head` on startup.

---

### 15.4 Frontend Deployment - Vercel

Set these Vercel environment variables:

```text
NEXTAUTH_URL             = https://trickee-platform.vercel.app
NEXTAUTH_SECRET          = same random secret family as backend, never public
BACKEND_URL              = https://<render-backend-url>
NEXT_PUBLIC_BACKEND_URL  = https://<render-backend-url>
```

If using a Next.js rewrite proxy, point it to the Render backend:

```typescript
// frontend/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${process.env.BACKEND_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

This proxies `/api/backend/*` through Next.js so the browser does not need to directly call the backend URL.

---

### 15.5 CI/CD

Recommended low-friction MVP flow:

- Render auto-deploys backend on push to the connected branch using `render.yaml`.
- Vercel auto-deploys frontend on push to the connected branch.
- Supabase remains the persistent cloud database.

GitHub Actions can be added later, but it is not required for the free MVP deployment path.

---

### 15.6 Final Deployed URLs

| Service | URL Pattern |
|---|---|
| Frontend (live demo) | `https://trickee-platform.vercel.app` |
| Backend API | `https://<render-backend-url>` |
| API Docs (Swagger) | `https://<render-backend-url>/docs` |
| Health check | `https://<render-backend-url>/health` |

---

### 15.7 Deployment Task Split

**Developer 1 (Backend -> Render + Supabase):**
- [ ] Create Supabase project and copy Postgres `DATABASE_URL`
- [ ] Create Render web service from `render.yaml`
- [ ] Set Render env vars
- [ ] Verify `/health`, `/docs`, `/api/v1/auth/login`, and smoke tests
- [ ] Update `ALLOWED_ORIGINS` after frontend URL is known

**Developer 2 (Frontend -> Vercel):**
- [ ] Deploy frontend to Vercel
- [ ] Set `BACKEND_URL` and `NEXT_PUBLIC_BACKEND_URL` to Render backend URL
- [ ] Smoke test all pages at the Vercel URL using all 3 roles

**Deployment order:**

```text
Dev 1 creates Supabase DB
Dev 1 deploys backend on Render
Dev 2 deploys frontend on Vercel using Render backend URL
Dev 1 updates ALLOWED_ORIGINS to the Vercel URL
Both run smoke tests on live URLs
```

---

## 16. Local vs Production Environment Reference

| Config | Local Dev | Production |
|---|---|---|
| Frontend URL | `http://localhost:3000` | `https://trickee-platform.vercel.app` |
| Backend URL | `http://localhost:8000` | `https://<render-backend-url>` |
| Database | Local SQLite/PostgreSQL | Supabase Postgres |
| NEXTAUTH_URL | `http://localhost:3000` | `https://trickee-platform.vercel.app` |
| ALLOWED_ORIGINS | `http://localhost:3000` | `https://trickee-platform.vercel.app` |
| Seed data | Run manually: `python -m app.utils.seed` | Auto-runs on Render startup and skips when users already exist |
| Model files | `backend/models_ml/` local | Same path inside Docker container |

---

*Trickee EV Intelligence Platform PRD v1.0 | April 2026 | Team of 2*
