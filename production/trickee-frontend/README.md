# Trickee Frontend

Next.js 14 dashboard for the Trickee EV Intelligence Platform.

## Local Setup

```powershell
cd production/trickee-frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Default local backend:

```text
http://localhost:8000/api/v1
```

Users authenticate with Google OAuth through the backend. The browser receives a Google ID token, exchanges it at `POST /api/v1/auth/google-login`, then stores the backend-issued Trickee access token and rotating refresh token.

## Backend Integration

API calls send the backend-issued Trickee access token as `Authorization: Bearer <token>`. When the access token expires, the frontend rotates the stored refresh token through `POST /api/v1/auth/refresh`.

Connected backend screens:

- Fleet overview: `GET /vehicles`
- Vehicle AI page: `POST /predictions/infer/{vehicle_id}` and `GET /vehicles/{vehicle_id}/telemetry`
- Alerts: `GET /alerts` and `POST /alerts/{alert_id}/resolve`
- Routes: `POST /routes/score` and `POST /routes/reroute`
- Driver profile: `GET /drivers/me` or fallback to `GET /drivers`
- Scorecards: `GET /drivers`
- Admin: `GET /admin/metrics` and `GET /admin/users`

V5/V6 intelligence API helpers are also available in `lib/api.ts`:

- `/intelligence/wait-time`
- `/intelligence/orders/assign`
- `/intelligence/charging/decision`
- `/intelligence/history/*`

## Deployment

Recommended deployment:

- Frontend: Vercel
- Backend: Google Cloud Run
- Database: Google Cloud SQL Postgres

Set these Vercel env vars:

```text
BACKEND_URL=https://<cloud-run-backend-url>/api/v1
NEXT_PUBLIC_BACKEND_URL=https://<cloud-run-backend-url>/api/v1
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<google-web-oauth-client-id>
```

`next.config.mjs` includes a rewrite for `/api/backend/*` if the app later wants to proxy backend calls through Next.js.
