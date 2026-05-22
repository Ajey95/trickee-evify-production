# Trickee Pilot Testing Plan
**Created:** 2026-05-20
**Purpose:** Pilot-readiness runbook for moving Trickee from demo use to Evify field testing.
**Scope:** 50-100 vehicle pilot first, then 500-600 vehicle scale-up after pilot success.

---

## 1. Final Architecture Decision

### Decision
For the 50-100 vehicle pilot, use the current production stack with hardening:

```txt
Evify vehicles
  -> FastAPI REST ingest / bulk ingest
  -> immediate validation and event checks from fresh payload
  -> Postgres telemetry history
  -> Redis latest/live state where configured
  -> WebSocket dashboard updates
  -> on-demand prediction, alerts, reports, and fleet views
```

Do **not** build MQTT, Kafka, TimescaleDB, or a full streaming platform before the pilot unless a hard load test proves the current stack cannot handle the pilot load.

### Why
- Pilot goal is product validation, not full IoT platform rebuild.
- Current code already has the right pilot primitives: REST ingest, bulk ingest, telemetry indexes, external API caching, H3 bucketing, rate limits, Redis hooks, and WebSocket live map.
- Building a full MQTT/Timescale/worker architecture before pilot will consume weeks and delay field validation.

### Scale Decision
For 500-600 vehicles, move to the planned streaming architecture:

```txt
Evify vehicles
  -> MQTT or queue broker
  -> consumer workers
  -> Redis live state
  -> Postgres partitioned telemetry or TimescaleDB history
  -> async inference workers
  -> async alert/nudge workers
  -> dashboard and reports read from live state + history
```

---

## 2. Pilot Load Assumptions

### Expected Pilot Size
- Initial pilot: 50-100 vehicles
- Post-pilot scale: 500-600 vehicles

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

---

## 3. Current Codebase Readiness

### Already Present

| Area | Current Status |
|---|---|
| Single telemetry ingest | Present at `POST /api/v1/telemetry/evify` |
| Bulk telemetry ingest | Present at `POST /api/v1/telemetry/evify/bulk` |
| Bulk row cap | `MAX_BULK_TELEMETRY_ROWS = 500` in `app/routers/telemetry.py` |
| Telemetry history DB | Normal Postgres table |
| Pilot telemetry indexes | Present in Alembic migration `0005_timeseries_pilot_indexes.py` |
| Vehicle-time index | `ix_telemetry_vehicle_recorded_at_desc` |
| Driver-time index | `ix_telemetry_driver_recorded_at_desc` |
| Time index | `ix_telemetry_recorded_at_desc` |
| BRIN time index | `ix_telemetry_recorded_at_brin` |
| External API caching | Present in `external_context.py` |
| H3 cache keys | Present for spatial bucketing |
| External quota guards | Present in settings/config |
| WebSocket live map | Present via `ws.py` and `ws_manager.py` |
| Redis live-map pub/sub hook | Present, requires `REDIS_URL` |
| SOC quality guard | Added for impossible SOC reset/jump filtering |

### Must Verify Before Pilot

- Confirm Alembic migrations are applied in production DB.
- Confirm `REDIS_URL` is configured if using Redis live state/pub-sub.
- Confirm `/telemetry/evify/bulk` is used by Evify integration instead of only single-row ingest.
- Confirm current Render instance has enough CPU/DB connections for burst writes.
- Confirm WebSocket fanout does not block ingest under active dashboard sessions.

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

### Pilot
Use normal Postgres with:
- composite indexes
- BRIN index on time
- batch ingest
- retention planning
- query limits
- latest-state reads where possible

This is enough for 50-100 vehicles if load tested.

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

---

## 8. Pilot Hardening Sprint

Recommended ask: **5-7 working days** before pilot field testing.

Minimum if rushed: **3 focused days**, but this leaves more operational risk.

### Day 1: Database and Migration Verification
- Run `alembic upgrade head` on production DB.
- Verify `0005_timeseries_pilot_indexes.py` is applied.
- Confirm telemetry indexes exist in Supabase/Postgres.
- Run `EXPLAIN ANALYZE` on latest-driver and latest-vehicle queries.
- Confirm seed/demo rows cannot override real telemetry.

### Day 2: Ingest Load Testing
- Test single ingest.
- Test bulk ingest with 500 rows.
- Test concurrent bulk ingest from 50 simulated vehicles.
- Verify response time, DB CPU, connection usage, and error rate.
- Confirm 413 is returned for payloads over 500 rows.

### Day 3: Redis and Live State
- Configure `REDIS_URL`.
- Verify latest vehicle state can be served without scanning full telemetry history.
- Confirm Redis fallback behavior if Redis is unavailable.
- Confirm Redis rate limiting works in production mode.

### Day 4: WebSocket and Dashboard Load
- Open multiple fleet dashboards.
- Stream telemetry under load.
- Confirm dashboard updates do not block ingest responses.
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

---

## 10. Required Verification: WebSocket Fanout Must Not Block Ingest

### Risk
Live-map WebSocket broadcasting can become dangerous if the ingest request waits for slow WebSocket clients.

Current code facts:
- `ws_manager.py` sends messages with `await ws.send_json(...)`.
- `publish_vehicle_point_from_thread(...)` bridges into async with `anyio.from_thread.run(...)`.
- Single-row ingest can publish after commit.
- Bulk ingest uses `commit=False` per row and commits once, so it does not currently broadcast each row.

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

### Recommended Fix If Blocking Is Observed
Move live-map fanout fully off the ingest request path:

```txt
ingest request
  -> commit telemetry
  -> enqueue live-point event to Redis/background task
  -> return response
background task
  -> broadcast to WebSocket clients
```

For pilot, the minimum safe approach is:
- do not broadcast per row in bulk ingest
- use Redis pub/sub or background task for live-map fanout
- set send timeout per client
- drop slow/stale clients

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

> We can pilot with the current architecture for 50-100 vehicles, provided we keep external APIs cached and event-triggered, use batch ingest, verify telemetry indexes, and decouple live dashboard fanout from the ingest path. If the pilot succeeds and we move to 500-600 vehicles, the planned scale upgrade is MQTT/queue ingestion, Redis live state, TimescaleDB or partitioned Postgres telemetry history, and worker-based inference/alerts.

This is technically honest and protects the project from both overbuilding too early and underbuilding for scale.

---

## 18. Immediate Next Actions

1. Run production `alembic upgrade head`.
2. Verify telemetry indexes exist in Supabase/Postgres.
3. Configure `REDIS_URL` if not already configured.
4. Load test `/api/v1/telemetry/evify/bulk` with 50 concurrent 500-row batches.
5. Test single-row ingest with 50+ WebSocket clients connected.
6. Confirm external API calls remain cached/event-triggered.
7. Replay Evify Data 7.0 through staging.
8. Confirm impossible SOC jumps are filtered.
9. Confirm FCM/push notification delivery on deployed Vercel URL.
10. Freeze demo/pilot scope and soft-lock features that are not connected to real feeds.

---

## 19. Test Pass - 2026-05-21

### Passed

| Area | Command / Check | Result |
|---|---|---|
| Backend tests | `python -m pytest tests -q` from `production/backend` | 45 passed |
| Backend syntax | `python -m py_compile` for changed routers/services | Passed |
| Alembic head | `alembic heads` | `0010_access_requests (head)` |
| DB migration state | `alembic current` against configured DB | `0010_access_requests (head)` |
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
