# Trickee Evify Production

Production-grade MVP for Trickee's EV fleet intelligence platform, built for the Evify pilot/demo.

This repository contains:

- a FastAPI backend for EV telemetry, AI prediction, auth, alerts, route intelligence, wait/order/charging intelligence, and V6-ready data capture;
- a Next.js frontend for fleet, driver, route, alert, model, and admin dashboards;
- analysis and roadmap documentation explaining what is built, what remains, and why the current architecture was chosen;
- Render/Vercel/Supabase deployment configuration

---

## Current Status

The project is a backend-connected MVP, not a static frontend.

Implemented:

- Firebase Auth mapped to backend Trickee users
- Backend JWT authorization with role-based access
- Admin, fleet operator, and driver roles
- Supabase Postgres database
- Alembic migrations
- Evify 28-04 telemetry ingestion/backfill
- V4.1 SOC/range prediction
- Driver behavior metrics
- Route scoring and rerouting
- Alerts and FCM foundations
- Wait classifier foundations
- Order assignment and charging decision foundations
- V5-A/V6 future-training foundations
- Next.js frontend dashboard
- Vercel frontend deployment
- Render backend deployment blueprint

Frontend production URL:

- `https://trickee-evify-live.vercel.app`

Backend target URL:

- `https://trickee-backend.onrender.com`

Backend is deploy-ready, but still needs Render project/API access and production secrets configured.

---

## Repository Layout

```text
.
├── analysis/
│   ├── built_implementation_and_remaining_work.md
│   ├── future_roadmapv2.md
│   ├── trickee_platform_prd.md
│   ├── trickee_next_stage_analysis.md
│   └── ...
├── production/
│   ├── backend/
│   │   ├── app/
│   │   ├── alembic/
│   │   ├── models_ml/
│   │   ├── tests/
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── README.md
│   └── trickee-frontend/
│       ├── app/
│       ├── components/
│       ├── lib/
│       ├── types/
│       ├── package.json
│       └── vercel.json
└── render.yaml
```

Important docs:

- `analysis/built_implementation_and_remaining_work.md`  
  Full implementation status, remaining work, deployment status, and pilot readiness.

- `analysis/trickee_platform_prd.md`  
  Main product requirements and architecture decision record.

- `analysis/future_roadmapv2.md`  
  Future roadmap and V6-ready foundation explanation.

- `production/backend/README.md`  
  Backend setup, endpoints, deployment, and smoke testing.

- `production/trickee-frontend/README.md`  
  Frontend setup and integration notes.

---

## Architecture

```text
Firebase Auth
     |
     v
Next.js Frontend  --->  FastAPI Backend  --->  Supabase Postgres
     |                         |
     |                         v
     |                  V4.1 ML Inference
     |                         |
     v                         v
Firebase FCM           Alerts / Predictions / Trips /
                       Driver Behavior / Wait Events /
                       Order Decisions / Charging Decisions
```

### Frontend

- Framework: Next.js 14 App Router
- Language: TypeScript
- Auth session: NextAuth
- Firebase: Auth + FCM token registration
- Deployment: Vercel

Frontend pages:

- Login
- Fleet Overview
- Vehicle AI Prediction
- Driver Profile
- Route Intelligence
- Scorecards
- Alerts
- Admin / Model Metrics

### Backend

- Framework: FastAPI
- ORM: SQLAlchemy
- Migrations: Alembic
- DB: Supabase Postgres
- ML: PyTorch/joblib artifacts
- Deployment target: Render Docker service

Backend domains:

- Auth
- Vehicles
- Drivers
- Predictions
- Routes
- Alerts
- Telemetry ingestion
- Intelligence history
- Wait classification
- Order assignment
- Charging decision support
- Admin metrics

---

## Roles

The app supports three roles:

| Role | Purpose |
|---|---|
| `trickee_admin` | Full system/admin/model access |
| `fleet_operator` | Fleet-level vehicle, driver, route, alert access |
| `driver` | Driver profile, own vehicle context, route intelligence, own alerts |

Backend role checks are enforced through JWT claims.

Frontend route visibility is role-aware through the dashboard sidebar and role guards.

---

## Main API Surface

Base path:

```text
/api/v1
```

Auth:

- `POST /auth/login`
- `POST /auth/firebase-login`
- `GET /auth/me`
- `POST /auth/fcm-token`
- `DELETE /auth/fcm-token`

Vehicles:

- `GET /vehicles`
- `GET /vehicles/me`
- `GET /vehicles/{vehicle_id}`
- `GET /vehicles/{vehicle_id}/telemetry`

Drivers:

- `GET /drivers`
- `GET /drivers/me`
- `GET /drivers/{driver_id}`
- `GET /drivers/{driver_id}/trips`

Predictions:

- `POST /predictions/infer/{vehicle_id}`
- `GET /predictions/{vehicle_id}/history`

Routes:

- `POST /routes/score`
- `POST /routes/reroute`

Alerts:

- `GET /alerts`
- `POST /alerts/{alert_id}/resolve`

Admin:

- `GET /admin/metrics`
- `GET /admin/users`

Intelligence:

- Driver behavior snapshots
- Wait history
- Order assignment history
- Charging decision history
- Nudge history

See `production/backend/app/routers/` for exact implementation.

---

## ML And Data

### Current Production Model

Current production path uses V4.1:

- predicts next SOC / range from telemetry windows;
- uses physics-adjusted range;
- does not use `delta_soc` as an input;
- stores prediction records;
- supports model metrics/admin visibility.

### V5-A / V6 Direction

V5-A and V6 are not the immediate production inference path.

Their foundations are present:

- V5-A training/evaluation scripts
- driver behavior snapshots
- trip storage
- nudge event storage
- wait event storage
- order assignment decision records
- charging decision records

V6 should be trained only after enough real longitudinal data exists.

---

## Data Ingestion

Evify 28-04 data support is implemented through:

- adapter normalization,
- JSON backfill,
- telemetry persistence,
- vehicle creation,
- driver ID preservation where present,
- derived physics features,
- duplicate timestamp protection.

Important pilot caveat:

- Backend seed telemetry can contaminate "latest" dashboard values if it has newer timestamps than historical Evify data.
- Before a real pilot demo, seed/demo telemetry should be removed or isolated.

---

## Local Backend Setup

From:

```powershell
cd "production/backend"
```

Create venv:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create `.env` from example:

```powershell
Copy-Item .env.example .env
```

Required local env values:

- `DATABASE_URL`
- `SECRET_KEY`
- `ALLOWED_ORIGINS`
- `FIREBASE_AUTH_ENABLED`
- `FIREBASE_FCM_ENABLED`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT_PATH`

Run migrations:

```powershell
alembic upgrade head
```

Run backend:

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Health check:

```powershell
Invoke-WebRequest http://127.0.0.1:8000/health
```

Run tests:

```powershell
python -m pytest
```

Expected current result:

```text
15 passed
```

---

## Local Frontend Setup

From:

```powershell
cd production/trickee-frontend
```

Install:

```powershell
npm install
```

Create `.env.local` from example:

```powershell
Copy-Item .env.example .env.local
```

Required local env values:

- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_BACKEND_URL`
- `NEXT_PUBLIC_FIREBASE_AUTH_ENABLED`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

Run frontend:

```powershell
npm run dev
```

Default URL:

```text
http://127.0.0.1:3000
```

Build:

```powershell
npm run build
```

---

## Deployment

### Frontend: Vercel

Current deployed frontend:

```text
https://trickee-evify-live.vercel.app
```

Required Vercel env vars:

- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `BACKEND_URL`
- `NEXT_PUBLIC_BACKEND_URL`
- Firebase public config
- Firebase VAPID key

Current frontend target backend:

```text
https://trickee-backend.onrender.com/api/v1
```

If backend Render URL changes, update Vercel env vars and redeploy.

### Backend: Render

`render.yaml` is configured for a Docker web service.

Required Render env vars:

- `DATABASE_URL`
- `SECRET_KEY`
- `ALLOWED_ORIGINS`
- `FIREBASE_AUTH_ENABLED`
- `FIREBASE_FCM_ENABLED`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- optional external API keys

Backend deploy command inside container:

```text
alembic upgrade head && python -m app.utils.seed && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

Current `render.yaml` sets `DEMO_SEED=false` for production.

---

## Security Notes

Do not commit:

- `.env`
- `.env.local`
- Firebase service account JSON
- Supabase database password
- Vercel `.vercel/`
- local SQLite DB files
- logs
- `.venv`
- `node_modules`
- `.next`

This repo includes examples only:

- `production/backend/.env.example`
- `production/backend/.env.production.example`
- `production/trickee-frontend/.env.example`

---

## Current Known Gaps

Highest priority before pilot:

1. Deploy backend to Render and configure secrets.
2. Update Vercel backend URL if Render URL differs.
3. Remove or isolate backend seed telemetry.
4. Verify Firebase login on deployed frontend.
5. Verify backend JWT session on deployed frontend.
6. Verify FCM browser push on deployed frontend.
7. Add frontend UI for wait/order/charging intelligence.
8. Add live replay or streaming runner for 28-04 data.
9. Add full 7-day route schedule UI.
10. Improve nudge outcome and trip history binding.

---

## Recommended Pilot Demo Flow

1. Login as admin/fleet.
2. Show Fleet Overview.
3. Open Vehicle AI Prediction.
4. Run V4.1 prediction and show dynamic range.
5. Login as driver.
6. Show Driver Profile and current vehicle context.
7. Open Route Intelligence.
8. Score routes and show personalized recommendation.
9. Trigger reroute scenario.
10. Show Alerts.
11. Explain V5/V6 foundations:
    - trips,
    - wait events,
    - nudge outcomes,
    - order assignment decisions,
    - charging decisions.

---

## Verification Snapshot

Recent checks:

- Backend tests: `15 passed`
- Frontend TypeScript: passed
- Frontend production build: passed
- Frontend deployed URL `/login`: HTTP `200`

Backend Render health is not active yet:

- `https://trickee-backend.onrender.com/health` currently returns `404`

This confirms the frontend is deployed, but production API calls need backend deployment completion.

