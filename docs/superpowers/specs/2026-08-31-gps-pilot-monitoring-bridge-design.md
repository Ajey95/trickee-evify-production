# GPS Pilot Monitoring Bridge Design

**Date:** 2026-08-31
**Status:** Approved for implementation

## 1. Objective

Add an admin-only `GPS Pilot` page to the existing `trickee.co.in` operations
workspace. The page must show the state of the standalone GPS Driver pilot
without exposing the pilot database, device credentials, or a privileged token
to the browser.

## 2. What Breaks First

The first risk is authorization, not rendering. The web workspace and GPS
Driver issue different application sessions. Reusing either JWT signing secret,
placing a long-lived GPS credential in Vercel, or connecting the browser to
Cloud SQL would create a cross-product privilege boundary that is difficult to
audit or revoke.

The second risk is operational ambiguity. A green API health check does not
prove that one-second windows are arriving, contiguous, processed, and finalized.
The monitoring response must therefore reconcile trip, cursor, finalizer,
rejection, and outbox state from the GPS Driver canonical database.

## 3. Chosen Architecture

```text
Admin browser
    | existing Trickee access token
    v
Main Trickee backend /api/v1/admin/gps-pilot
    | verifies trickee_admin
    | short-lived Google service identity token
    v
GPS Driver /api/v2/internal/pilot-monitoring
    | verifies audience and allowlisted caller service account
    | bounded read-only SQLAlchemy queries
    v
GPS Driver PostgreSQL and live-state projection
```

The browser continues to trust only the main Trickee backend. The main backend
acts as a narrow proxy and never receives GPS database credentials. The GPS
Driver endpoint accepts only a short-lived Google-signed identity token whose
audience and service-account email match explicit configuration.

The page is restricted to `trickee_admin` in both the sidebar and server-side
authorization. Client-side role hiding is convenience only; it is not the
security boundary.

## 4. Monitoring Contract

The GPS endpoint returns one bounded snapshot:

- `generated_at` and upstream health state;
- aggregate counts for active trips, recent windows, GPS gaps, recent
  rejections, pending outbox records, and stuck finalizations;
- active and recently updated vehicle live-state rows with last packet age,
  freshness, projection status, coordinates, GPS availability, trip and
  sequence identifiers;
- the 20 most recent trips with status, finalization state, expected final
  sequence, stored window count, GPS window count, GPS availability percentage,
  highest contiguous upload sequence, processed sequence, and energy-label
  eligibility;
- the 20 most recent rejections with stable code and message;
- backlog age and maximum delivery-attempt count.

The response excludes tokens, installation identifiers, raw payloads, exact
user emails, database connection data, and unrestricted one-second records.
Coordinates are available because this is an admin-only operational screen,
but are not written to application logs or metric labels.

## 5. User Experience

The sidebar adds `GPS Pilot` for `trickee_admin`. The page contains:

1. compact status cards for service state, active trips, last packet age, GPS
   coverage, and unresolved issues;
2. an active-vehicle panel with position, freshness, sequence, and collector
   health;
3. a recent-trip table with explicit collection, upload, and finalization state;
4. an issue list for rejections, missing sequences, outbox backlog, and stuck
   finalizers;
5. a manual refresh control and the time of the last successful snapshot.

The page refreshes at most every 30 seconds, stops while hidden or offline, and
refreshes immediately when visible again. A failed refresh preserves the last
successful snapshot and shows a restrained stale-data warning. Loading, empty,
partial, and unavailable states are first-class UI states.

## 6. Security and Reliability

- Main-backend authorization requires an active `trickee_admin` user.
- GPS service identity verification fails closed when audience or caller
  allowlist configuration is absent.
- Outbound proxy calls have a six-second timeout and no user-controlled URL.
- Upstream errors are normalized; internal token, network, or database details
  are never returned to the browser.
- Queries are read-only, bounded, indexed by existing trip/time/state columns,
  and use SQLAlchemy rather than interpolated SQL.
- No schema migration is required.
- GPS monitoring failure cannot affect existing admin routes or mobile
  telemetry ingestion.

## 7. Deployment and Rollback

Deploy the GPS Driver endpoint first with its caller allowlist. Deploy the main
backend proxy second with the GPS endpoint URL and audience. Deploy the frontend
last. Verify access denial before granting the main backend service identity.

Rollback removes the sidebar item/frontend page first, then the main proxy.
The GPS read-only endpoint can remain disabled by clearing the allowlist. No
database rollback is required.

## 8. Verification

- GPS backend tests prove missing, invalid, wrong-audience, and unapproved
  service identities are rejected and approved identities receive only the
  bounded snapshot.
- Query tests cover empty state, active trip, GPS gaps, rejection, backlog, and
  completed energy label.
- Main backend tests prove driver/fleet users receive 403, admins receive the
  normalized upstream snapshot, and timeout/upstream failures are safe.
- Frontend type checking and production build pass.
- Rendered QA proves sidebar navigation, loading, populated, empty, stale, error,
  desktop, and mobile behavior without framework or console errors.

## 9. Scale Boundary

At one to ten pilot vehicles, a 30-second bounded snapshot is inexpensive. At
1,000 vehicles, the endpoint must add pagination and pre-aggregated operational
rollups. At 100,000 vehicles, per-request aggregation is inappropriate; a
dedicated observability store and streaming dashboard are required. This pilot
change intentionally does not pre-build that future system.
