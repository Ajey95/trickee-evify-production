# GPS Pilot Monitoring Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only GPS Pilot monitoring page to `trickee.co.in` through a secure, read-only service-to-service bridge.

**Architecture:** The existing admin browser calls only the main Trickee backend. That backend validates `trickee_admin`, obtains a short-lived Google identity token, and proxies a bounded snapshot from a GPS Driver internal monitoring endpoint that validates the token audience and allowlisted service-account email before running read-only aggregate queries.

**Tech Stack:** FastAPI, SQLAlchemy, Google Auth, HTTPX, Next.js 14, React 18, TypeScript, Tailwind CSS, pytest.

**Spec:** `docs/superpowers/specs/2026-08-31-gps-pilot-monitoring-bridge-design.md`

## Global Constraints

- The browser never receives GPS database credentials, service credentials, or a second privileged application token.
- Both backends enforce authorization; sidebar role filtering is not a security boundary.
- Monitoring queries are read-only and return at most 20 recent trips and 20 recent rejections.
- Coordinates are returned only to authorized admins and never used in logs or metric labels.
- Automatic refresh is no more frequent than 30 seconds and pauses while hidden or offline.
- No database migration or JWT-secret sharing is allowed.
- Existing telemetry ingestion, live-state processing, and admin routes must remain independently available.

---

### Task 1: GPS service identity boundary

**Files:**
- Modify: `../gpsdriver/backend/app/config.py`
- Create: `../gpsdriver/backend/app/services/monitoring_identity.py`
- Test: `../gpsdriver/backend/tests/test_pilot_monitoring_identity.py`
- Modify: `../gpsdriver/backend/.env.example`

**Interfaces:**
- Consumes: `Authorization: Bearer <Google identity token>`.
- Produces: `require_monitoring_caller(authorization: str | None) -> MonitoringCaller`.

- [ ] **Step 1: Write failing identity tests** for missing configuration, missing bearer token, wrong audience, unapproved caller email, and an approved caller.
- [ ] **Step 2: Run** `python -m pytest tests/test_pilot_monitoring_identity.py -q` from `gpsdriver/backend` and verify failure because the dependency does not exist.
- [ ] **Step 3: Implement configuration and verification** using `google.oauth2.id_token.verify_oauth2_token`, an exact configured audience, normalized comma-separated service-account allowlist, issuer validation, and fail-closed HTTP responses.
- [ ] **Step 4: Run the identity test file** and verify all cases pass.
- [ ] **Step 5: Record the change**; if repository Git metadata is usable, commit `feat: protect GPS pilot monitoring with service identity`.

### Task 2: Bounded GPS monitoring snapshot

**Files:**
- Create: `../gpsdriver/backend/app/services/pilot_monitoring.py`
- Create: `../gpsdriver/backend/app/routers/pilot_monitoring.py`
- Modify: `../gpsdriver/backend/app/main.py`
- Test: `../gpsdriver/backend/tests/test_pilot_monitoring.py`

**Interfaces:**
- Consumes: SQLAlchemy `Session` and verified `MonitoringCaller`.
- Produces: `build_pilot_monitoring_snapshot(db: Session, now: datetime | None = None) -> dict` and `GET /api/v2/internal/pilot-monitoring` returning `{success, data}`.

- [ ] **Step 1: Write failing snapshot tests** that seed empty, active, rejected, backlogged, gap, and completed-label states and assert bounded sanitized output.
- [ ] **Step 2: Run** `python -m pytest tests/test_pilot_monitoring.py -q` and verify the module/route is missing.
- [ ] **Step 3: Implement aggregate queries** for live state, recent trips, cursor/finalizer reconciliation, GPS availability, recent rejections, and server outbox health without returning raw payloads or user/device identity.
- [ ] **Step 4: Register the route** in `app/main.py` and enforce `require_monitoring_caller` at the router boundary.
- [ ] **Step 5: Run snapshot and identity tests** and verify they pass.
- [ ] **Step 6: Record the change**; if repository Git metadata is usable, commit `feat: expose bounded GPS pilot health snapshot`.

### Task 3: Main backend admin proxy

**Files:**
- Modify: `production/backend/app/config.py`
- Create: `production/backend/app/services/gps_pilot_client.py`
- Create: `production/backend/app/routers/gps_pilot.py`
- Modify: `production/backend/app/main.py`
- Modify: `production/backend/.env.example`
- Modify: `production/backend/scripts/deploy_cloud_run.ps1`
- Test: `production/backend/tests/test_gps_pilot_proxy.py`

**Interfaces:**
- Consumes: authenticated main-backend user and configured GPS endpoint/audience.
- Produces: `fetch_gps_pilot_snapshot() -> dict` and `GET /api/v1/admin/gps-pilot` returning the standard `{success, data}` envelope.

- [ ] **Step 1: Write failing proxy tests** proving a driver receives 403, an admin receives a mocked snapshot, missing configuration returns 503, and timeout/upstream authorization errors return sanitized 502/503 responses.
- [ ] **Step 2: Run** `python -m pytest tests/test_gps_pilot_proxy.py -q` from `production/backend` and verify failure because the route does not exist.
- [ ] **Step 3: Implement the client** with `google.oauth2.id_token.fetch_id_token`, a six-second HTTPX timeout, a fixed configured HTTPS origin in production, response-shape validation, and safe error normalization.
- [ ] **Step 4: Implement and register the route** using `require_roles("trickee_admin")`.
- [ ] **Step 5: Add non-secret deployment configuration** for the monitoring URL and audience; never add a service-account key to the environment.
- [ ] **Step 6: Run proxy tests and the existing backend suite** and verify no regressions.
- [ ] **Step 7: Record the change**; if repository Git metadata is usable, commit `feat: proxy GPS pilot monitoring for admins`.

### Task 4: Admin sidebar and monitoring page

**Files:**
- Create: `production/trickee-frontend/types/gps-pilot.ts`
- Modify: `production/trickee-frontend/lib/api.ts`
- Modify: `production/trickee-frontend/lib/roles.ts`
- Modify: `production/trickee-frontend/components/layout/Sidebar.tsx`
- Modify: `production/trickee-frontend/components/layout/Topbar.tsx`
- Create: `production/trickee-frontend/app/(dashboard)/gps-pilot/page.tsx`

**Interfaces:**
- Consumes: `api.admin.gpsPilot({ cacheTtlMs: 0 })` returning `GpsPilotSnapshot`.
- Produces: admin route `/gps-pilot` and a `GPS Pilot` sidebar item restricted to `trickee_admin`.

- [ ] **Step 1: Add exact TypeScript contracts** for summary, live vehicle, trip health, rejection, and outbox state.
- [ ] **Step 2: Add the API client method and navigation route** with admin-only role metadata and a restrained satellite/navigation icon.
- [ ] **Step 3: Build the page** with skeleton, empty, populated, stale, and unavailable states; compact status cards; active vehicle rows; recent trips; issues; last-updated time; and manual refresh.
- [ ] **Step 4: Add visibility-aware refresh** at 30 seconds with in-flight deduplication, offline pause, resume refresh, and cleanup.
- [ ] **Step 5: Run** `npm run build` from `production/trickee-frontend` and correct all type/build errors.
- [ ] **Step 6: Record the change**; if repository Git metadata is usable, commit `feat: add GPS pilot admin monitoring page`.

### Task 5: Infrastructure configuration and operational verification

**Files:**
- Modify: `../gpsdriver/infra/gcp/variables.tf`
- Modify: `../gpsdriver/infra/gcp/main.tf`
- Modify: `Trickee/analysis/built_implementation_and_remaining_work.md`
- Modify: `Trickee/analysis/daily_logger.md`
- Modify: `../gpsdriver/analysis/built_implementation_and_remaining_work.md`
- Modify: `../gpsdriver/analysis/daily_logger.md`

**Interfaces:**
- Consumes: main backend Cloud Run service-account email and GPS API service URL.
- Produces: deployed environment values `TRICKEE_MONITORING_AUDIENCE`, `TRICKEE_MONITORING_CALLER_SERVICE_ACCOUNTS`, `GPS_PILOT_MONITORING_URL`, and `GPS_PILOT_MONITORING_AUDIENCE`.

- [ ] **Step 1: Add Terraform variables and GPS API environment wiring** without granting database or secret access to the main backend service account.
- [ ] **Step 2: Verify local backend suites**, GPS tests, frontend build, and secret scans.
- [ ] **Step 3: Run rendered QA** for `/gps-pilot` at desktop and mobile widths, exercising sidebar navigation and refresh/error behavior with no framework overlay or relevant console errors.
- [ ] **Step 4: If cloud authentication is available, deploy in order** GPS endpoint, main proxy, then frontend; verify unauthorized/authorized behavior and rollback points after every step.
- [ ] **Step 5: Update both project closeout logs** with exact commands, pass counts, artifact/revision URLs, and any external authentication or live-data verification still pending.
- [ ] **Step 6: Record the change**; if repository Git metadata is usable, commit `docs: record GPS pilot monitoring verification`.
