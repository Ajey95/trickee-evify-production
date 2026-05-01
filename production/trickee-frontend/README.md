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

Demo users are authenticated through the FastAPI backend when Firebase env is off:

- `admin@trickee.ai` / `Trickee@2026`
- `fleet@evify.in` / `Evify@2026`
- `driver1@evify.in` / `Driver@2026`

## Backend Integration

The frontend uses NextAuth for the app session. With Firebase disabled, credentials are validated by the backend endpoint:

```text
POST /api/v1/auth/login
```

The backend JWT is stored in the NextAuth session and sent as `Authorization: Bearer <token>` by `lib/api.ts`.

When Firebase is enabled, the browser signs in with Firebase Auth first, sends the Firebase ID token to:

```text
POST /api/v1/auth/firebase-login
```

The backend verifies the Firebase token, maps it to the Trickee user/role, then returns the same Trickee JWT session used by the rest of the dashboard.

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
NEXTAUTH_URL=https://<vercel-frontend-url>
NEXTAUTH_SECRET=<secure-secret>
BACKEND_URL=https://<render-backend-url>/api/v1
NEXT_PUBLIC_BACKEND_URL=https://<render-backend-url>/api/v1
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
