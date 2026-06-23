# Frontend Integration

This backend is ready to run locally for mobile/frontend integration.

## Start The API

From the repo root:

```powershell
cd backend
.\start.ps1
```

If the Supabase/Postgres database is not reachable while you are doing local Android work, start with a local SQLite database:

```powershell
.\start.ps1 -LocalDb
```

This mode skips Alembic migrations and lets the seed script create the local SQLite schema, because some production migrations intentionally use Postgres-only extensions and indexes.

Local demo login is enabled only in that mode:

```text
POST /api/v1/auth/login
admin@trickee.ai / Trickee@2026
fleet@evify.in / Evify@2026
driver1@evify.in / Driver@2026
```

The API listens on:

```text
http://127.0.0.1:8000
```

For Android emulator networking, use:

```text
http://10.0.2.2:8000
```

For a physical phone on the same Wi-Fi network, use this computer's LAN IP:

```text
http://<YOUR-LAN-IP>:8000
```

All REST API routes are under:

```text
/api/v1
```

Health check:

```text
GET /health
```

## Auth Flow

Primary mobile login should use Firebase:

```text
POST /api/v1/auth/firebase-login
Authorization: none
Body: { "id_token": "<firebase-id-token>" }
```

Successful response shape:

```json
{
  "success": true,
  "data": {
    "access_token": "...",
    "token_type": "bearer",
    "user": {}
  },
  "message": "OK",
  "error": null
}
```

After login, send the returned token on backend requests:

```text
Authorization: Bearer <access_token>
```

Useful auth endpoints:

```text
GET /api/v1/auth/me
POST /api/v1/auth/fcm-token
DELETE /api/v1/auth/fcm-token
POST /api/v1/auth/logout
```

## Mobile Driver Endpoints

```text
GET /api/v1/mobile/me
POST /api/v1/mobile/location
POST /api/v1/mobile/voice/resolve-destination
POST /api/v1/mobile/trips/start
POST /api/v1/mobile/trips/end
POST /api/v1/mobile/charging/start
POST /api/v1/mobile/charging/end
POST /api/v1/mobile/waiting/start
POST /api/v1/mobile/waiting/end
POST /api/v1/mobile/issues
GET /api/v1/mobile/alerts
POST /api/v1/mobile/alerts/{alert_id}/ack
```

## WebSocket

First request a short-lived ticket:

```text
GET /api/v1/auth/ws-ticket
```

Then connect to:

```text
ws://127.0.0.1:8000/ws/live-map?ticket=<ticket>
```

Use `ws://10.0.2.2:8000/ws/live-map?ticket=<ticket>` from the Android emulator.

## Response Contract

Successful responses use:

```json
{
  "success": true,
  "data": {},
  "message": "OK",
  "error": null
}
```

Error responses use:

```json
{
  "success": false,
  "data": null,
  "message": "Error",
  "error": "..."
}
```
