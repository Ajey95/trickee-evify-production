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

Users authenticate with Supabase Auth. Supabase email/password users must be mapped to a Trickee backend user by email or `supabase_user_id`.

For emergency rollback only, set `NEXT_PUBLIC_LEGACY_AUTH_ENABLED=true` in the frontend and `LEGACY_AUTH_ENABLED=true` in the backend to temporarily allow the old backend password login.

## Backend Integration

The frontend stores the Supabase browser session through `@supabase/ssr`. API calls send the Supabase access token as `Authorization: Bearer <token>`; the backend verifies it with `SUPABASE_JWT_SECRET`, then loads the internal Trickee user, role, fleet, and driver scope.

FCM browser alerts are available through the topbar `Push Alerts` button. The browser token is registered at:

```text
POST /api/v1/auth/fcm-token
```

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
- Backend: Render
- Database: Supabase Postgres

Set these Vercel env vars:

```text
BACKEND_URL=https://<render-backend-url>/api/v1
NEXT_PUBLIC_BACKEND_URL=https://<render-backend-url>/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
NEXT_PUBLIC_LEGACY_AUTH_ENABLED=false
NEXT_PUBLIC_FIREBASE_AUTH_ENABLED=true
NEXT_PUBLIC_FIREBASE_API_KEY=<firebase-web-api-key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<firebase-project-id>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<project>.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<sender-id>
NEXT_PUBLIC_FIREBASE_APP_ID=<web-app-id>
NEXT_PUBLIC_FIREBASE_VAPID_KEY=<web-push-vapid-key>
```

`next.config.mjs` includes a rewrite for `/api/backend/*` if the app later wants to proxy backend calls through Next.js.
