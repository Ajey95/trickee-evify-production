# Trickee Pilot Testing Plan
**Created:** 2026-05-20
**Purpose:** Pilot-readiness runbook for moving Trickee from demo use to Evify field testing.
**Scope:** 50-100 vehicle pilot first, then 500-600 vehicle scale-up after pilot success.

---

## 1. Final Architecture Decision

### Auth vs Data Ownership

Use Supabase only as the identity layer:

```txt
Supabase Auth
  -> email/password, OAuth, sessions, JWT issuing
  -> backend verifies Supabase JWT locally through JWKS
  -> backend maps supabase_user_id/email to internal Trickee users, roles, fleets, and drivers
```

Do **not** use Supabase free database as the long-term telemetry store.

Current Supabase free-tier limits are useful for auth/dev but not telemetry-heavy production:

| Area | Free-tier relevance to Trickee |
|---|---|
| Auth MAU | Good for early auth usage; 50k MAU is enough for pilot auth |
| Database size | Not enough for sustained telemetry; 500 MB can be crossed quickly |
| Realtime connections | Not the main Trickee realtime layer; use backend WebSockets/Redis |
| Storage/egress | Not suitable for heavy telemetry, media, analytics, or exports |

Source links for current limits:
- Supabase pricing: `https://supabase.com/pricing`
- Supabase database size behavior: `https://supabase.com/docs/guides/platform/database-size`
- Supabase MAU billing: `https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users`

Final infra direction:

```txt
Supabase Auth only
  -> FastAPI backend
  -> GCP Cloud SQL Postgres for operational + telemetry DB
  -> Redis/Memorystore for latest vehicle state, rate limits, cache, and live-map pub/sub
  -> BigQuery for analytics/export later
  -> Google Cloud Storage for files
  -> Pub/Sub + workers when burst/retry requirements justify it
```

### Active Pilot Option A: Fastest Reliable Pilot

Use this path now because the backend is already on Render and the frontend is already on Vercel:

```txt
Supabase Auth
  -> Vercel frontend
  -> Render FastAPI backend
  -> GCP Cloud SQL Postgres over public IP with restricted access
  -> Upstash Redis over TLS
  -> Google Maps / OpenWeather external APIs
  -> Firebase FCM browser push
```

Why this is the pilot path:

- fastest to ship
- minimal backend deployment change
- keeps Supabase only for identity/session/JWT
- moves telemetry storage away from Supabase free DB
- gives Redis live state without VPC networking complexity
- still allows later migration to Cloud Run/Memorystore without redesigning app code

Required Option A env shape:

```env
DATABASE_URL=postgresql://trickee_app:<password>@<cloud-sql-public-ip>:5432/trickee?sslmode=require
REDIS_URL=rediss://default:<password>@<upstash-host>:<port>
LIVE_STATE_REDIS_ENABLED=true
LIVE_STATE_TTL_SECONDS=300
```

Security requirement for Option A:

- Cloud SQL must not be open to `0.0.0.0/0` for pilot.
- Use Render static/dedicated outbound IP if available.
- Add only the Render outbound IP/range to Cloud SQL authorized networks.
- Keep SSL required in the connection string.
- Keep database user scoped to the Trickee database, not superuser.

Cloud SQL pilot configuration decision:

| Setting | Pilot choice |
|---|---|
| Cloud SQL edition | **Enterprise** |
| Avoid by default | **Enterprise Plus** |
| PostgreSQL version | **PostgreSQL 16** |
| Region | **asia-southeast1 (Singapore)** |
| Machine | `db-custom-2-8192` or equivalent |
| vCPU / RAM | **2 vCPU / 8 GB RAM** |
| Storage | **20 GB SSD** to start, with automatic storage increase enabled |
| Availability | **Multiple zones / HA** is acceptable because company GCP credits are available |
| Connection mode | Public IP for Render Option A |
| Authorized networks | Render outbound/static IP range only |
| SSL mode | Allow only SSL connections |
| Backups | Automated backups enabled |
| PITR | Enabled |
| Data cache | Disabled |
| Deletion protection | Enabled |

Why **Enterprise**, not Enterprise Plus:

- 50-100 vehicle pilot load is small for Postgres when ingest is batched and live state is in Redis.
- Worst-case 50 vehicles at one row every 2 seconds is about 25 writes/second before batching.
- Enterprise Plus features are useful for larger production workloads, not required for this pilot.
- Do not buy performance by over-sizing Cloud SQL; use Redis/WebSocket for realtime live state.

Enterprise Plus is only justified if the company explicitly approves it for:

- strict customer-facing SLA requirements
- 500-600 vehicle production rollout
- heavy read traffic that Cloud SQL Enterprise cannot handle after query/index tuning
- advanced disaster recovery requirements
- managed connection pooling requirement
- near-zero downtime scale-up requirement

Notes from GCP setup discussion:

- PostgreSQL 16 is chosen for stability and broad compatibility with SQLAlchemy, Alembic, and `psycopg2`.
- PostgreSQL 17 is acceptable later, but PostgreSQL 18 should be avoided for this pilot unless there is a hard requirement.
- 100 GB storage is okay if credits allow it, but storage size does not change the database version decision.
- With about Rs 19 lakh GCP credits, keeping **Enterprise + HA multiple zones** is reasonable.
- Do not switch back to Enterprise Plus only because credits exist; spend credits on HA, backups, load testing, BigQuery, Cloud Run migration, and later Memorystore/Pub/Sub.

### Later Option B: Cleaner GCP-Native Scale Path

Move to this after pilot validation or before 500-600 vehicles if the team has time to migrate deployment:

```txt
Supabase Auth
  -> Vercel frontend or Cloud Run frontend
  -> Cloud Run FastAPI backend
  -> Cloud SQL Postgres via private IP / Cloud SQL connector
  -> Memorystore Redis via VPC connector
  -> Pub/Sub telemetry topic
  -> worker services for DB writes, live state, alerts, AI inference
  -> BigQuery analytics/export
  -> Google Cloud Storage for files/reports
```

Why Option B is cleaner:

- backend, database, Redis, workers, logs, IAM, networking, and billing are all inside GCP
- Cloud SQL can use private connectivity instead of public IP allowlisting
- Memorystore works naturally through VPC networking
- Pub/Sub gives retryable async ingestion and decouples request latency from downstream processing
- BigQuery can handle analytics without stressing operational telemetry tables
- easier to use GCP credits for database, storage, analytics, and compute

Option B target components:

| Layer | GCP target |
|---|---|
| Backend API | Cloud Run |
| Operational DB | Cloud SQL PostgreSQL |
| Time-series history | Cloud SQL Postgres initially, partitioning/Timescale strategy later |
| Latest live state | Memorystore Redis |
| Async events | Pub/Sub |
| Workers | Cloud Run jobs/services or Cloud Functions |
| Analytics | BigQuery |
| File/report storage | Google Cloud Storage |
| Secrets | Secret Manager |
| Logs/metrics | Cloud Logging + Cloud Monitoring |

Option B networking:

```txt
Cloud Run
  -> Serverless VPC Access / direct VPC egress
  -> Cloud SQL private IP or Cloud SQL connector
  -> Memorystore private IP
```

Do not expect GCP Memorystore to work directly from Render. Memorystore is private-network oriented. If the backend remains on Render, use Upstash or another internet-accessible Redis provider.

Option B migration steps:

1. Create Cloud SQL PostgreSQL instance.
2. Create `trickee` database and `trickee_app` DB user.
3. Migrate current Postgres data with `pg_dump` / `pg_restore`.
4. Run `alembic upgrade head`.
5. Deploy FastAPI backend to Cloud Run.
6. Move backend secrets to Secret Manager.
7. Create Memorystore Redis instance in same region/VPC.
8. Configure Cloud Run VPC access to reach Cloud SQL/Memorystore.
9. Set:

```env
DATABASE_URL=<Cloud SQL connector/private connection string>
REDIS_URL=redis://<memorystore-private-ip>:6379
LIVE_STATE_REDIS_ENABLED=true
LIVE_STATE_TTL_SECONDS=300
```

10. Add Pub/Sub topic:

```txt
trickee.telemetry.raw
```

11. Add workers:

```txt
db-writer-worker
live-state-worker
alert-worker
ai-inference-worker
analytics-export-worker
```

12. Keep API synchronous only for validation/acknowledgement; move slow work to workers.
13. Export daily/weekly analytics to BigQuery.
14. Load test again before switching production traffic.

Option B trigger conditions:

- pilot succeeds and fleet moves toward 500-600 vehicles
- Render public-IP DB access becomes operationally risky
- ingestion needs guaranteed retry after backend restarts
- dashboard live state must support multiple backend workers
- analytics queries start affecting operational API latency
- AI/alert processing needs to be decoupled from ingest response time

### Decision
For the 50-100 vehicle pilot, use the current production stack with hardening and move production storage to GCP:

```txt
Evify vehicles
  -> FastAPI REST ingest / bulk ingest
  -> immediate validation and event checks from fresh payload
  -> GCP Cloud SQL Postgres telemetry history
  -> Redis/Memorystore latest/live state
  -> WebSocket dashboard updates
  -> on-demand prediction, alerts, reports, and fleet views
```

Do **not** build MQTT, Kafka, TimescaleDB, or a full streaming platform before the pilot unless a hard load test proves the current stack cannot handle pilot load.

Do not rely on **Supabase free DB** for a field pilot that is expected to generate around 100k telemetry rows/day. Use **GCP Cloud SQL Postgres** as the pilot database target. A paid managed Postgres can be used only as a short fallback if Cloud SQL setup blocks the pilot date.

### Why
- Pilot goal is product validation, not full IoT platform rebuild.
- Current code already has the right pilot primitives: REST ingest, bulk ingest, telemetry indexes, external API caching, H3 bucketing, rate limits, Redis hooks, and WebSocket live map.
- Building a full MQTT/Timescale/worker architecture before pilot will consume weeks and delay field validation.
- Auth is not the bottleneck. Telemetry writes, history storage, geospatial queries, live-state reads, and analytics are the bottlenecks.

### Scale Decision
For 500-600 vehicles, move to the planned streaming architecture:

```txt
Evify vehicles
  -> Pub/Sub, MQTT, or queue broker
  -> consumer/worker services
  -> Redis live state
  -> Postgres partitioned telemetry or TimescaleDB history
  -> BigQuery analytics
  -> async inference workers
  -> async alert/nudge workers
  -> dashboard and reports read from live state + history
```

Hard rule:

```txt
Mobile app / driver browser / Evify feed
  -> Ingestion API
  -> backend validation, auth, rate limits, normalization
  -> DB/queue
```

Never allow the mobile app or browser client to insert telemetry directly into Postgres.

---

## 2. Pilot Load Assumptions

### Expected Pilot Size
- Initial pilot: 50-100 vehicles
- Post-pilot scale: 500-600 vehicles

### Expected Confirmed Volume
Current planning assumption:

```txt
~100,000 telemetry rows/day
= ~3,000,000 rows/month
```

This is not high from a write-throughput perspective:

```txt
100,000 rows/day / 86,400 seconds
= ~1.16 rows/second average
```

So a batched FastAPI ingestion API plus properly indexed Postgres can handle it.

The problem is not average requests/sec. The problem is accumulated storage, indexes, retention, backups, query shape, and burst behavior.

Supabase free DB is not suitable for this because the free database size is 500 MB. Depending on row width, JSON fields, indexes, and retained metadata, 3 million telemetry rows/month can easily exceed that. Treat Supabase free as auth/dev only, not telemetry storage.

### Telemetry Rate
Evify data can arrive every 2-3 seconds in the ideal case, but the latest dataset showed many intervals closer to 30-60 seconds. Plan for the worst case anyway.

Worst-case estimate:

```txt
100 vehicles
1 row every 2 seconds
= 50 rows/second
= 3,000 rows/minute
= 180,000 rows/hour
= ~1.4-1.8 million rows/day for 8-10 active hours
```

This is high but manageable for a pilot if:
- writes are batched
- latest-state reads avoid scanning history
- telemetry queries use correct indexes
- external APIs are cached and event-triggered
- inference does not run on every telemetry row
- telemetry retention is explicitly defined
- DB disk and backup policy are production-grade

### Storage Decision For 100k Rows/Day

Use this rule:

| Scenario | Recommended storage |
|---|---|
| Local development | SQLite/local Postgres is fine |
| Demo/internal alpha | Supabase free DB can be used carefully, but do not depend on it for telemetry retention |
| 100k rows/day pilot | GCP Cloud SQL Postgres |
| 500-600 vehicle scale | Cloud SQL with partitioning/Timescale strategy plus BigQuery analytics |

Minimum production telemetry database requirements:

- enough disk for at least 30-90 days of retained telemetry
- daily backups
- migration control through Alembic
- composite indexes on latest vehicle/driver queries
- retention/archive policy
- no direct frontend writes

---

## 3. Current Codebase Readiness

### Already Present

| Area | Current Status |
|---|---|
| Single telemetry ingest | Present at `POST /api/v1/telemetry/evify` |
| Bulk telemetry ingest | Present at `POST /api/v1/telemetry/evify/bulk` |
| Bulk row cap | `MAX_BULK_TELEMETRY_ROWS = 500` in `app/routers/telemetry.py` |
| Empty bulk batch rejection | Present; empty batches return `400` |
| Telemetry history DB | Normal Postgres table |
| Pilot telemetry indexes | Present in Alembic migration `0005_timeseries_pilot_indexes.py` |
| Vehicle-time index | `ix_telemetry_vehicle_recorded_at_desc` |
| Driver-time index | `ix_telemetry_driver_recorded_at_desc` |
| Time index | `ix_telemetry_recorded_at_desc` |
| BRIN time index | `ix_telemetry_recorded_at_brin` |
| Duplicate protection | Unique index `ux_telemetry_vehicle_recorded_at` in migration `0011_telemetry_ingest_scale_guards.py` / revision `0011_ingest_scale` |
| External API caching | Present in `external_context.py` |
| H3 cache keys | Present for spatial bucketing |
| External quota guards | Present in settings/config |
| WebSocket live map | Present via `ws.py` and `ws_manager.py`; live publish is scheduled after commit |
| Redis live-map pub/sub hook | Present, requires `REDIS_URL` |
| Redis latest vehicle/driver state | Present; live-map reads Redis first, then falls back to Postgres |
| SOC quality guard | Added for impossible SOC reset/jump filtering |

### Must Verify Before Pilot

- Confirm Alembic migrations are applied in production DB through `0011_ingest_scale`.
- Confirm `REDIS_URL` is configured for Redis live state/pub-sub/rate limits/cache.
- Confirm `/telemetry/evify/bulk` is used by Evify integration instead of only single-row ingest.
- Confirm current Render instance has enough CPU/DB connections for burst writes.
- Confirm scheduled WebSocket fanout does not block ingest under active dashboard sessions.
- Confirm the deployed Vercel dashboard is usable from a mobile browser for driver accounts.
- Confirm browser geolocation permission works on the deployed HTTPS URL and the driver's current browser location appears on `/map`.
- Confirm role-based navigation on mobile:
  - driver sees only driver-safe pages
  - fleet manager sees fleet operations pages
  - Trickee admin sees admin/ops pages

---

## 4. Immediate Decision Path

The system should not wait for "write to DB -> read back from DB -> decide" for urgent actions.

For pilot, the correct immediate path is:

```txt
Incoming telemetry payload
  -> validate payload
  -> normalize Evify fields
  -> compute derived fields
  -> compare with previous latest row when needed
  -> run cheap deterministic checks immediately
  -> write telemetry history
  -> update live state / broadcast dashboard
  -> trigger only necessary alerts
```

Immediate checks can use:
- current payload
- previous latest telemetry row
- cached driver profile
- cached route/context data
- Redis latest state, if configured

Do not run expensive work per row:
- no LSTM inference per 2-second message
- no Google Places call per row
- no OpenWeather call per row
- no Google Directions/Traffic call per row
- no LLM call per row

### Pilot Debug Logging

The backend now emits structured telemetry ingest logs for pilot debugging:

```txt
telemetry_ingest request_id=<id> user_id=<id> vehicle_id=<id> driver_id=<id> alert_created=<bool> elapsed_ms=<ms>
telemetry_bulk_ingest request_id=<id> user_id=<id> rows=<n> vehicles=<n> drivers=<n> elapsed_ms=<ms>
telemetry_bulk_rejected request_id=<id> user_id=<id> rows=<n> max_rows=500 reason=too_large
```

How to inspect during pilot:

1. Open Render Dashboard.
2. Select the Trickee backend service.
3. Open **Logs**.
4. Search for:
   - `telemetry_bulk_ingest`
   - `telemetry_bulk_rejected`
   - `request_id=<id>`
   - `elapsed_ms=`
5. If a frontend/API call fails, copy the `X-Request-ID` response header from browser Network tab and search the same ID in Render logs.

Do not log raw telemetry payloads during pilot unless debugging a specific adapter issue. Logs should identify request shape, row count, vehicle/driver linkage, latency, and rejection reason without exposing full location streams.

---

## 5. External API Policy

External APIs must be event-triggered and cached.

### Allowed Triggers

| API | Trigger |
|---|---|
| OpenWeatherMap | new H3/geocell, TTL expired, or trip/session start |
| Google Elevation | new route segment/geocell, long TTL |
| Google Traffic/Directions | route planning, reroute, departure nudge, ETA refresh |
| Google Places | low-SOC stop event, charging recommendation request, route/charger decision |

### Forbidden Pattern

```txt
Every telemetry row -> external API call
```

This is the exact failure mode that caused high Google Maps request volume earlier.

---

## 6. Inference Policy

Inference should run on demand, not on every telemetry row.

Allowed inference triggers:
- dashboard prediction page load
- explicit `/api/v1/predictions/{vehicle_id}` request
- scheduled background refresh every 5 minutes per active vehicle
- risk event where cheap rules say prediction is necessary

Forbidden:

```txt
Every 2-second telemetry push -> LSTM inference
```

---

## 7. Database Strategy

### Auth Database

Supabase Auth can remain in Supabase.

The backend should treat Supabase as the external identity provider and keep Trickee's app authorization in its own internal tables:

```txt
Supabase auth.users
  -> Supabase JWT
  -> FastAPI verifies JWT locally
  -> internal users table maps supabase_user_id/email to:
       role
       fleet_id
       driver_id
       is_active
```

Do not authorize drivers, admins, or fleet managers from editable frontend metadata.

### Telemetry And Operational Database

For sustained 100k rows/day, use normal Postgres on production-grade infrastructure:

- GCP Cloud SQL Postgres is the pilot target.
- Existing managed Postgres is acceptable only as a short fallback if Cloud SQL setup blocks the pilot date and disk, backups, indexes, and connection limits are adequate.
- Supabase free DB is not acceptable for sustained telemetry storage.

Use Postgres with:
- composite indexes
- BRIN index on time
- batch ingest
- retention planning
- query limits
- latest-state reads where possible

This is enough for 50-100 vehicles and ~100k rows/day if load tested.

### Queue Decision

Do not add Pub/Sub just because the daily row count is 100k.

At 100k rows/day, average write rate is low enough for direct batched API writes:

```txt
Evify/mobile feed
  -> FastAPI ingest
  -> validate/normalize
  -> update Redis latest state
  -> batch insert into Postgres
```

Add Pub/Sub when one or more of these become true:

- burst traffic causes API or DB write latency
- ingestion must survive backend restarts without data loss
- workers need independent retries
- alert/inference processing must be decoupled from ingest response time
- fleet moves toward 500-600 vehicles
- multiple downstream consumers need the same telemetry stream

### After Pilot
For 500-600 vehicles, choose one:

1. Postgres partitioned telemetry tables
2. TimescaleDB hypertables

TimescaleDB is useful when:
- time-window analytics become heavy
- retention/compression matters
- fleet grows beyond pilot scale
- dashboards/reports query many days or months of telemetry

It is not mandatory for the first pilot.

### Analytics Storage

Do not run heavy analytics directly on hot telemetry tables once the dataset grows.

Use:

```txt
Postgres / Timescale
  -> operational recent history, latest trip/session records

BigQuery
  -> long-range analytics, cohort reports, model evaluation datasets, exports
```

---

## 8. Pilot Hardening Sprint

Recommended ask: **5-7 working days** before pilot field testing.

Minimum if rushed: **3 focused days**, but this leaves more operational risk.

Current implementation order:

```txt
1. Scale-hardening current pilot architecture
2. Load-test ingest, Redis/live state, and WebSocket fanout
3. Fix any bottlenecks found by load tests
4. Then set up CI/CD workflow automation
```

CI/CD is important, but it comes after the scaling path is stable enough to know what needs to be protected by automated checks.

### Day 1: Database and Migration Verification
- Decide final pilot DB target:
  - Supabase Auth remains in Supabase.
  - Telemetry DB should be GCP Cloud SQL Postgres, not Supabase free DB.
- Verify Cloud SQL pilot instance settings:
  - Enterprise edition, not Enterprise Plus.
  - PostgreSQL 16.
  - Region `asia-southeast1`.
  - 2 vCPU / 8 GB RAM.
  - 20 GB SSD minimum with automatic storage increase.
  - Multiple zones enabled if company credits/billing approval is confirmed.
  - Public IP enabled only for Render Option A.
  - Authorized networks limited to Render outbound/static IP range.
  - SSL-only connections.
  - automated backups, PITR, and deletion protection enabled.
- Run `alembic upgrade head` on the selected production telemetry/operational DB.
- Verify `0005_timeseries_pilot_indexes.py` and `0011_telemetry_ingest_scale_guards.py` / revision `0011_ingest_scale` are applied.
- Confirm telemetry indexes exist in the selected production Postgres database.
- Confirm unique duplicate guard exists:
  - `ux_telemetry_vehicle_recorded_at`
- Run `EXPLAIN ANALYZE` on latest-driver and latest-vehicle queries.
- Confirm seed/demo rows cannot override real telemetry.
- Estimate row size and monthly storage at 100k rows/day, including indexes.

### Day 2: Ingest Load Testing
- Test single ingest.
- Test bulk ingest with 500 rows.
- Test concurrent bulk ingest from 50 simulated vehicles.
- Verify response time, DB CPU, connection usage, and error rate.
- Confirm 413 is returned for payloads over 500 rows.

### Day 3: Redis and Live State
- Configure `REDIS_URL`.
- Keep `LIVE_STATE_REDIS_ENABLED=true`.
- Keep `LIVE_STATE_TTL_SECONDS=300` unless pilot network conditions require a longer stale window.
- Verify latest vehicle/driver state can be served from Redis without scanning full telemetry history.
- Confirm Redis fallback behavior if Redis is unavailable.
- Confirm Redis rate limiting works in production mode.
- Confirm immediate alert checks can use current payload plus Redis/latest cached state without waiting for a DB readback.

### Day 4: WebSocket and Dashboard Load
- Open multiple fleet dashboards.
- Stream telemetry under load.
- Confirm scheduled dashboard updates do not block ingest responses.
- Confirm disconnected WebSocket clients are removed.
- Confirm Redis pub/sub path works for multi-worker deployment.

### Day 5: External API and Alert Safety
- Verify H3/TTL caching.
- Verify quota counters.
- Simulate low-SOC stop event.
- Confirm Google Places is only called on event trigger.
- Confirm notification/alert logic does not loop.

### Days 6-7: Pilot Dry Run and Rollback
- Replay real Evify data.
- Confirm daily telemetry volume estimate.
- Confirm logs and request IDs.
- Confirm alert/fallback behavior.
- Prepare rollback plan and pilot checklist.

---

## 9. Required Verification: Bulk Ingest 500-Row Limit Under Concurrency

### Risk
The endpoint has a 500-row limit, but the pilot risk is concurrent burst behavior:

```txt
500 rows x 50 vehicles = 25,000 rows in one burst window
```

The code currently checks the per-request length, but we must verify behavior under parallel requests.

### What To Verify
- A request with 501 rows returns `413`.
- 50 concurrent requests with 500 rows each do not crash the API.
- DB connections do not exhaust.
- Response latency stays acceptable.
- No duplicate telemetry rows are created for the same vehicle/timestamp.
- Rate limiting behavior is intentional and documented.
- Partial failures are visible in logs.

### Acceptance Criteria

| Metric | Pilot Target |
|---|---|
| 500-row batch accepted | Yes |
| 501-row batch rejected | HTTP 413 |
| 50 concurrent batches | No API crash |
| Error rate | Less than 1% excluding expected rate-limit/duplicate rejections |
| p95 latency | Under 2 seconds for accepted batch under pilot load |
| DB connection exhaustion | No |
| Duplicate rows | No |

### Suggested Test Shape

```txt
50 virtual vehicles
each sends 500 rows
same 1-second burst
repeat for 5-10 rounds
measure API, DB, and logs
```

### Evify 7.0 Replay Tool

Do not host the `Evify data 7.0` files behind a temporary API just to test ingest. The clean test is to replay the local JSON files into the real backend bulk endpoint:

```txt
Evify data 7.0/*.json
  -> replay script
  -> POST /api/v1/telemetry/evify/bulk
  -> FastAPI validation/auth/rate limit
  -> Cloud SQL telemetry write
  -> Redis latest live state
  -> scheduled WebSocket fanout
```

Replay script:

```txt
production/backend/scripts/replay_evify_bulk.py
```

Dry run command:

```powershell
production\backend\.venv\Scripts\python.exe production\backend\scripts\replay_evify_bulk.py `
  --data-dir "D:\projects\trickee-evify-production\Evify data 7.0" `
  --dry-run `
  --batch-size 500
```

Current dry-run evidence from Evify 7.0:

| Metric | Value |
|---|---:|
| Files read | 48 |
| Rows | 90,833 |
| 500-row batches | 205 |

Local/staging replay command shape:

```powershell
$env:TRICKEE_API_TOKEN="<admin-or-fleet-operator-bearer-token>"
production\backend\.venv\Scripts\python.exe production\backend\scripts\replay_evify_bulk.py `
  --data-dir "D:\projects\trickee-evify-production\Evify data 7.0" `
  --base-url "http://localhost:8000" `
  --batch-size 500 `
  --concurrency 10
```

Production/staging URL example:

```powershell
production\backend\.venv\Scripts\python.exe production\backend\scripts\replay_evify_bulk.py `
  --data-dir "D:\projects\trickee-evify-production\Evify data 7.0" `
  --base-url "https://trickee-evify-production.onrender.com" `
  --batch-size 500 `
  --concurrency 10
```

Increase concurrency gradually:

| Stage | Concurrency | Purpose |
|---|---:|---|
| Smoke | 1 | confirm auth, schema, DB write |
| Small burst | 5 | confirm batch behavior |
| Pilot load | 10-20 | realistic replay pressure |
| Stress | 50 | worst-case burst check |

Important:
- Use a real `trickee_admin` or `fleet_operator` bearer token.
- Do not run production replay until the target database is intentional.
- Keep `--batch-size` at 500; the API must reject 501 rows with HTTP 413.
- For capacity testing, temporarily raise `TELEMETRY_RATE_LIMIT_PER_MINUTE` in staging or expect HTTP 429. The current bulk route applies roughly one quarter of that limit per user.
- Watch Render logs for `telemetry_bulk_ingest`, `telemetry_bulk_rejected`, latency, rate limits, and DB connection errors.
- Watch Cloud SQL for CPU, active connections, slow queries, and write latency.

---

## 10. Required Verification: WebSocket Fanout Must Not Block Ingest

### Risk
Live-map WebSocket broadcasting can become dangerous if the ingest request waits for slow WebSocket clients.

Current code facts:
- `ws_manager.py` sends messages with `await ws.send_json(...)`.
- `schedule_vehicle_point_publish(...)` schedules publish work after telemetry commit.
- Single-row ingest schedules one live-map publish after commit.
- Bulk ingest uses `commit=False` per row, commits once, then publishes only the latest point per vehicle.
- Bulk ingest does not broadcast every row.

### What To Verify
- Single-row ingest latency with 0 WebSocket clients.
- Single-row ingest latency with 10, 50, and 100 WebSocket clients.
- Behavior when one client is slow or disconnected.
- Whether Redis pub/sub publish adds latency.
- Whether dashboard fanout blocks the response path.

### Acceptance Criteria

| Metric | Pilot Target |
|---|---|
| Ingest response waits on slow WS client | No |
| Disconnected clients cleaned up | Yes |
| Bulk ingest broadcasts per row | No |
| Redis listener runs in background task | Yes |
| Ingest p95 with dashboards open | Under 1 second for single row |

### Current Fix Implemented
Live-map fanout is now scheduled after commit:

```txt
ingest request
  -> commit telemetry
  -> schedule live-point publish to background task
  -> return response
background task
  -> broadcast to WebSocket clients
```

Remaining hardening after load test:
- set send timeout per client if slow-client tests show backpressure
- drop slow/stale clients aggressively
- use Redis pub/sub with `REDIS_URL` in multi-worker deployments

---

## 11. Pilot Monitoring Checklist

Track these during dry run and field testing:

- ingest requests/minute
- rows ingested/minute
- API p50/p95/p99 latency
- DB CPU
- DB connections
- slow queries
- rate-limit hits
- duplicate telemetry skips
- SOC quality rejections
- external API calls/day by provider
- external API cache hit rate
- WebSocket active connections
- WebSocket send failures
- alert count by type
- notification send/fallback count
- prediction request count
- LLM request count and fallback rate

---

## 12. Data Quality Notes From Evify Data 7.0

Latest checked dataset:
- 48 vehicle JSON files
- 90,833 telemetry rows
- GPS present for all rows
- valid SOC in most rows
- ignition ON in nearly all rows
- charging-status rows not detected
- median interval around 30 seconds
- p90 around 60 seconds
- p99 contains large gaps

Important issue:
- Some rows contain impossible SOC jumps such as near `0 -> 100`.
- These must not become training labels, charging events, or false alerts.

Implemented/required guard:
- filter implausible SOC transitions
- reject unrealistic 5-minute SOC deltas during evaluation/training
- avoid treating impossible SOC rise as charging

Pilot implication:
- The system can be pilot-ready only if SOC quality guards stay enabled.
- Evify should still confirm `ChargePlugStatus` correctness because opportunistic charging and true charging detection depend on it.

---

## 13. Pilot Scope Lock

### Safe To Show In Pilot
- live fleet dashboard
- live map
- current SOC/range view
- battery prediction with confidence/fallback
- driver/fleet summaries
- rule-based alerts
- fallback-safe personalized notification wording
- charger recommendation only with clear "availability not confirmed" when real slot data is unavailable

### Soft Lock Or Label Carefully
- recommender-system claims that require destination/order feed
- real-time charger slot availability unless Bolt/Pulse/UBC integration exists
- WhatsApp delivery unless approved templates and opt-in are configured
- full conversational assistant unless tool grounding and auth are verified in production
- RL nudge optimization
- V6 driver embeddings

### Do Not Mock As Real
For pitch/demo, use controlled demo data only if clearly described internally as demo mode. Do not claim live production decisions where the system is not connected to real Evify/order/charger feeds.

---

## 14. Destination And Stop-Reason Intelligence

To send the right opportunistic charging notification, the system needs some way to infer or receive where the driver is going and why the driver stopped.

### Best Sources

| Source | Quality | Notes |
|---|---|---|
| Order platform destination | Best | Restaurant/customer destination and prep time unlock charging decisions |
| Fleet dispatch system | Best | Planned route, stops, shift plan |
| Driver app input | Good | Manual destination if no order integration |
| Historical route pattern | Medium | Can infer usual depot/restaurant/customer zones |
| Stop clustering | Medium | Detect repeated halt locations |
| Google Places nearby context | Useful | Helps label area type, not intent |

### Pilot Approach
For pilot, start with:
- current GPS
- ignition on/off
- speed and stop duration
- SOC and predicted arrival SOC
- known depot/restaurant/customer zones if available
- optional manual destination field
- order feed integration later

This allows useful opportunistic charging without pretending the system knows every destination.

---

## 15. Context Signals And What They Unlock

| Signal | What It Enables |
|---|---|
| Ignition ON | trip start, departure nudge, route/range check |
| Ignition OFF | stop detection, end-trip analysis, parking/charging opportunity |
| Speed near zero | wait-time charging opportunity |
| Traffic | ETA correction, route risk, battery drain prediction |
| Weather | thermal penalty, range derating, heat stress warnings |
| Day type | weekday/weekend behavior baseline |
| Occasion/festival | traffic surge, demand surge, route delay risk |
| Area type | charger/food/depot/customer-context inference |
| Time of day | usual departure, shift pattern, risk windows |
| SOC trend | drain anomaly, low-SOC escalation |
| Current/voltage/temp | battery stress and model features |

These signals should feed deterministic services first. LLMs should only explain or personalize outputs after backend facts are computed.

---

## 16. Timeline To Ask Management

### For 50-100 Vehicle Pilot
Ask for **5-7 working days** for hardening and dry-run testing.

Breakdown:
- 1 day: DB migration/index verification
- 1 day: bulk ingest load testing
- 1 day: Redis/live-state verification
- 1 day: WebSocket/dashboard load testing
- 1 day: external API/alert safety testing
- 1-2 days: fixes, replay test, documentation, rollback plan

### For 500-600 Vehicle Scale-Up
Ask for **3-6 weeks** after pilot success.

Breakdown:
- MQTT/queue ingestion
- worker-based processing
- Redis latest-state layer
- TimescaleDB or partitioned Postgres
- async inference/alert workers
- observability dashboards
- retention/compression strategy

---

## 17. Final Message To Evify

Use this positioning:

> We can pilot with the current backend architecture for 50-100 vehicles, provided we keep external APIs cached and event-triggered, use batch ingest, verify telemetry indexes, and decouple live dashboard fanout from the ingest path. Supabase remains the auth/session provider, while telemetry and operational data move to GCP Cloud SQL Postgres and Upstash Redis handles latest live state, cache, rate limits, and live-map pub/sub from the current Render backend. At the expected 100k rows/day, direct batched API writes to Cloud SQL are acceptable after load testing; Pub/Sub/workers become necessary when burst/retry requirements grow or when we scale toward 500-600 vehicles. If the pilot succeeds, the planned scale upgrade is Cloud Run, Pub/Sub/MQTT ingestion, Memorystore Redis, partitioned Postgres/Timescale strategy, BigQuery analytics, and worker-based inference/alerts.

This is technically honest and protects the project from both overbuilding too early and underbuilding for scale.

---

## 18. Immediate Next Actions

1. Keep Supabase Auth for login/session/JWT.
2. Use Option A for fastest pilot:
   - Render FastAPI backend
   - GCP Cloud SQL Postgres
   - Upstash Redis
   - Vercel frontend
3. Run production `alembic upgrade head` on the selected operational/telemetry DB.
4. Verify telemetry indexes exist in the selected production Postgres database.
5. Configure `REDIS_URL` from Upstash, `LIVE_STATE_REDIS_ENABLED=true`, and `LIVE_STATE_TTL_SECONDS=300`.
6. Load test `/api/v1/telemetry/evify/bulk` with 50 concurrent 500-row batches.
7. Test single-row ingest with 50+ WebSocket clients connected.
8. Confirm external API calls remain cached/event-triggered.
9. Replay Evify Data 7.0 through staging.
10. Confirm impossible SOC jumps are filtered.
11. Confirm FCM/push notification delivery on deployed Vercel URL.
12. Confirm mobile browser map location permission on deployed Vercel URL.
13. Confirm role-filtered mobile navigation for driver, fleet manager, and admin demo accounts.
14. Freeze demo/pilot scope and soft-lock features that are not connected to real feeds.

### Option A Cloud SQL Migration Status - 2026-05-22

Cloud SQL target is now migrated and upgraded:

| Check | Result |
|---|---|
| Old Supabase app DB reachable | Yes |
| New Cloud SQL DB reachable | Yes |
| Cloud SQL database | `trickee` |
| Cloud SQL user | `trickee1` |
| PostgreSQL version | 16.13 |
| Alembic current | `0011_ingest_scale` |
| Critical unique index | `ux_telemetry_vehicle_recorded_at` present |

Data migration result:

| Table / metric | Supabase before migration | Cloud SQL after migration |
|---|---:|---:|
| `users` | 4 | 4 |
| `fleets` | 1 | 1 |
| `vehicles` | 7 | 7 |
| `drivers` | 9 | 9 |
| `trips` | 4 | 4 |
| `telemetry` total rows | 100,492 | 98,982 |
| `telemetry` distinct vehicle/timestamp rows | 98,982 | 98,982 |

Why telemetry count changed:

- Supabase had duplicate telemetry rows for the same `(vehicle_id, recorded_at)`.
- Migration `0011_ingest_scale` deletes duplicate vehicle/timestamp rows before adding the unique index.
- Cloud SQL now has one row per vehicle/timestamp, which is required for concurrent ingest safety.

Restore notes:

- Supabase-only RLS policies targeting role `authenticated` did not restore on Cloud SQL. This is acceptable because Cloud SQL is accessed by the backend service user, not exposed through Supabase Data API.
- Supabase Auth remains in Supabase. Only the Trickee app/operational tables moved to Cloud SQL.
- Source Supabase Postgres was 17.6; target Cloud SQL Postgres is 16.13. This is acceptable for Trickee because the schema uses normal Postgres features and does not depend on Postgres 17-only behavior.
- The restore warning for `SET transaction_timeout = 0` came from the Postgres 17 dump and was ignored by Cloud SQL 16; it did not affect table/data restore.
- Keep production/staging migrations tested against Cloud SQL Postgres 16 unless the project intentionally upgrades later.

Remaining cutover steps:

1. Update Render `DATABASE_URL` to the Cloud SQL connection string.
2. Keep Supabase auth env vars unchanged.
3. Confirm Render startup logs show `alembic upgrade head` with no migration errors.
4. Run post-deploy smoke tests.
5. Remove temporary local IP `49.37.133.38/32` from Cloud SQL authorized networks after migration verification.

---

## 19. Test Pass - 2026-05-21

### Passed

| Area | Command / Check | Result |
|---|---|---|
| Backend tests | `python -m pytest tests -q` from `production/backend` | 48 passed on 2026-05-22 |
| Backend syntax | `python -m py_compile` for changed routers/services | Passed |
| Alembic head | `alembic heads` | Previously `0010_access_requests`; current code adds `0011_ingest_scale` |
| DB migration state | `alembic current` against configured DB | Must be upgraded to `0011_ingest_scale` before pilot |
| Frontend lint | `npm run lint` from `production/trickee-frontend` | Passed |
| Frontend production build | `npm run build` | Passed |
| Render health | `GET https://trickee-evify-production.onrender.com/health` | 200 OK, V4.1 model ready |
| Secret-pattern scan | Source/docs scan excluding `.env*`, `.next`, `node_modules`, venvs | No exposed concrete Google/API secrets found outside env files |
| Google Directions smoke | `external_context.directions()` | `google_directions` |
| Google Elevation smoke | `external_context.elevation_delta()` | `google_elevation` |
| Google Places smoke | `external_context.nearest_chargers()` | `google_places_new`, 10 charger results |

### Fixed During Test Pass

- Charger lookup previously fell back because code called legacy Places `nearbysearch/json` while GCP had Places API (New) enabled.
- Backend now prefers Places API (New): `places.googleapis.com/v1/places:searchNearby`.
- Legacy Places nearby search remains as fallback only.

### Security / Dependency Findings

Frontend:

- `npm audit --omit=dev --audit-level=high` still reports a high Next.js advisory on `next@14.2.35`.
- `npm audit fix` reduced transitive findings by updating lockfile packages such as `protobufjs` and `ws`.
- Remaining audit fix requires `npm audit fix --force`, which upgrades to Next 16 and is a breaking migration. Do not force this during pilot without a dedicated migration branch.

Backend:

- `pip-audit -r requirements.txt` reported vulnerable packages:
  - `python-jose==3.3.0`
  - `python-multipart==0.0.9`
  - `starlette==0.36.3` through current FastAPI stack
  - `torch==2.2.2`
  - `joblib==1.4.0`
  - `pytest==8.1.1`
  - transitive `pyjwt`
- Do not silently upgrade Torch/FastAPI/Starlette before pilot without a compatibility pass. Prioritize low-risk auth/upload package upgrades first, then plan ML runtime upgrade separately.

### Still Required Before Pilot

1. Run actual bulk load test: 50 concurrent requests x 500 rows.
2. Run WebSocket fanout load test with 50+ connected dashboard clients.
3. Verify FCM push delivery on deployed Vercel URL.
4. Run authenticated production Postman/API smoke with real admin/fleet/driver tokens.
5. Decide whether to branch a dependency-hardening sprint for Next/FastAPI/Torch upgrades before external pilot.

---

## 20. CI/CD Process For Pilot

This section is the handoff checklist for the teammate owning deployment quality.

### Current Deployment Reality

Current repo state:

| Area | Current setup |
|---|---|
| Backend deploy | Render web service from `render.yaml` |
| Backend runtime | Dockerfile at `production/backend/Dockerfile` |
| Backend start command | `alembic upgrade head && python -m app.utils.seed && uvicorn app.main:app` |
| Frontend deploy | Vercel Next.js app from `production/trickee-frontend` |
| Frontend config | `production/trickee-frontend/vercel.json` |
| GitHub Actions | Present at `.github/workflows/pilot-ci.yml` for backend tests/Alembic sanity, frontend lint/build, and tracked env/service-account blocking |

Required deployment gate:

```txt
GitHub push/PR
  -> CI checks
  -> merge only if checks pass
  -> Render/Vercel deploy
  -> post-deploy smoke tests
```

Do not rely only on Render/Vercel build logs to catch problems. Broken migrations, failed tests, or missing env checks should fail before deployment.

### Required GitHub Actions Workflows

Maintain `.github/workflows/pilot-ci.yml`.

Minimum jobs:

1. Backend tests
2. Frontend lint/build
3. Migration sanity
4. Secret/env safety checks

Recommended workflow shape:

```yaml
name: Pilot CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: production/backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - name: Install backend deps
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
      - name: Compile backend
        run: python -m compileall app
      - name: Run backend tests
        run: pytest tests -q
      - name: Check Alembic has one head
        run: alembic heads

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: production/trickee-frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: production/trickee-frontend/package-lock.json
      - name: Install frontend deps
        run: npm ci
      - name: Lint frontend
        run: npm run lint
      - name: Build frontend
        run: npm run build

  secret-safety:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Block env files from commit
        shell: bash
        run: |
          if git ls-files | grep -E '(^|/)\.env($|\.|.production|.local)'; then
            echo "Tracked .env file detected. Remove it from git."
            exit 1
          fi
```

Notes:

- CI should not use production secrets.
- CI can use SQLite/test env for unit tests unless a Postgres-specific test is added.
- Do not run `alembic upgrade head` against production from GitHub Actions.
- Production migrations should happen during Render startup or a controlled manual deployment step.

### Backend CI Requirements

Backend checks that must pass before merge:

```txt
cd production/backend
python -m compileall app
pytest tests -q
alembic heads
```

Expected current baseline:

```txt
48 tests passing
single Alembic head: 0011_ingest_scale
```

Backend CI must fail if:

- tests fail
- app cannot compile
- multiple Alembic heads exist
- migration files are missing after model changes
- `.env` files are tracked
- production-only features require unset fallback secrets

### Frontend CI Requirements

Frontend checks that must pass before merge:

```txt
cd production/trickee-frontend
npm ci
npm run lint
npm run build
```

Frontend CI must fail if:

- lint fails
- TypeScript/build fails
- public env variables are missing for required deployed features
- build accidentally depends on local-only files
- `.env.local` or real secrets are committed

### Render Backend Deployment Process

Render service is defined in `render.yaml`.

Required Render env variables before pilot:

```env
ENVIRONMENT=production
DATABASE_URL=<GCP Cloud SQL Postgres connection string>
SECRET_KEY=<strong secret>
ALLOWED_ORIGINS=https://trickee-evify-live.vercel.app
SUPABASE_URL=<supabase project url>
SUPABASE_JWKS_URL=<supabase jwks url>
SUPABASE_JWT_AUDIENCE=authenticated
LEGACY_AUTH_ENABLED=false
REDIS_URL=<Upstash rediss:// URL for Option A pilot>
LIVE_STATE_REDIS_ENABLED=true
LIVE_STATE_TTL_SECONDS=300
GROQ_API_KEY=<groq key>
GROQ_MODEL=llama-3.1-8b-instant
GOOGLE_MAPS_API_KEY=<server key>
GOOGLE_PLACES_API_KEY=<server key, can be same as maps key>
OPENWEATHER_API_KEY=<weather key>
FIREBASE_FCM_ENABLED=true
FIREBASE_PROJECT_ID=<firebase project id>
FIREBASE_SERVICE_ACCOUNT_JSON=<firebase service account json>
```

Render deploy checklist:

1. Confirm GitHub CI passed on the commit.
2. Confirm Render picked the correct commit SHA.
3. Confirm build succeeds.
4. Confirm startup runs `alembic upgrade head`.
5. Confirm `/health` returns 200.
6. Confirm backend logs show no migration failure.
7. Confirm request IDs appear in API responses/logs.

Post-deploy backend smoke:

```txt
GET /health
GET /api/v1/auth/me with valid Supabase JWT
GET /api/v1/intelligence/live-map with fleet/admin token
POST /api/v1/telemetry/evify/bulk with small test batch
POST /api/v1/notifications/personalize with test driver/vehicle
POST /api/v1/alerts/test-push after browser token registration
```

### Vercel Frontend Deployment Process

Vercel config lives at `production/trickee-frontend/vercel.json`.

Required Vercel env variables before pilot:

```env
NEXT_PUBLIC_BACKEND_URL=https://trickee-evify-production.onrender.com/api/v1
NEXT_PUBLIC_SUPABASE_URL=<supabase project url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase anon key>
NEXT_PUBLIC_FIREBASE_API_KEY=<firebase web api key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<firebase auth domain>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<firebase project id>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<firebase sender id>
NEXT_PUBLIC_FIREBASE_APP_ID=<firebase app id>
NEXT_PUBLIC_FIREBASE_VAPID_KEY=<firebase web push vapid key>
```

Never put these in Vercel frontend env:

```txt
SUPABASE_SERVICE_ROLE_KEY
FIREBASE_SERVICE_ACCOUNT_JSON
GROQ_API_KEY
GOOGLE_PLACES_API_KEY if unrestricted
GOOGLE_MAPS_API_KEY if it is the unrestricted server key
DATABASE_URL
SECRET_KEY
```

Vercel deploy checklist:

1. Confirm GitHub CI frontend job passed.
2. Confirm Vercel build succeeds.
3. Open deployed site.
4. Login with admin, fleet manager, and driver accounts.
5. Confirm role-filtered pages:
   - driver sees driver-safe pages only
   - fleet manager sees fleet ops pages
   - admin sees admin/ops pages
6. Confirm mobile browser layout works.
7. Confirm `/map` can request geolocation permission on HTTPS.
8. Confirm push alert permission and FCM token registration.

### Post-Deploy Pilot Smoke Matrix

Run this after every production deployment:

| Area | Test | Expected |
|---|---|---|
| Backend health | `GET /health` | 200, model ready |
| Auth | login then `GET /api/v1/auth/me` | correct role/fleet/driver |
| Role access | visit protected pages per role | unauthorized pages redirect |
| Live map | `/map` load | vehicle points or empty state, no crash |
| Mobile GPS | tap `Use my location` | browser permission prompt and marker |
| Bulk ingest | small test batch | rows accepted or duplicate-safe |
| External APIs | charger/directions smoke | Google source or explicit fallback |
| AI tools | assistant/route/battery/charger checks | tool-grounded response or safe fallback |
| Notifications | `Push Alerts` then test push | browser receives foreground/background push |
| Logs | search request ID in Render | matching structured log found |

### CI/CD Blockers For Pilot

Do not start field pilot if any of these are true:

- GitHub CI is absent or failing.
- Render backend deploy does not run migrations successfully.
- Production DB is not on Alembic head.
- Frontend points to wrong backend URL.
- Supabase JWT verification fails in production.
- Driver/fleet/admin role access is broken.
- `.env` or service account secrets are tracked in git.
- Bulk ingest has not been load-tested.
- WebSocket fanout has not been tested with dashboards open.
- FCM deployed browser receipt is not verified.

### Rollback Process

Minimum rollback plan:

1. Keep the last known-good Render deploy available.
2. Keep the last known-good Vercel deploy available.
3. If frontend breaks, rollback Vercel first.
4. If backend breaks after migration:
   - stop new telemetry ingest if necessary
   - inspect Render logs
   - verify DB migration state
   - redeploy previous backend only if migration compatibility is safe
5. Do not run destructive DB rollback commands during pilot without taking a backup.

### Ownership

Suggested ownership for teammate:

| Area | Owner responsibility |
|---|---|
| GitHub Actions | create and maintain CI workflows |
| Render | env vars, deploy status, backend logs |
| Vercel | env vars, frontend build/deploy, mobile check |
| Database | migration status, index verification, backup check |
| Smoke tests | run post-deploy matrix after every release |
| Pilot logs | collect request IDs and deployment evidence |
