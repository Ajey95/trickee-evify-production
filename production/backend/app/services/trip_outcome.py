"""
trip_outcome.py
---------------
Closes an inferred trip and updates the driver's personal_factor using an
exponential moving average of observed vs Google-predicted travel time.

Design decision (2026-05-12):
  personal_factor update is pure backend arithmetic — no LLM, no agent.
  The agent layer is only for natural-language output.

  Formula:
    observed_factor = actual_trip_min / google_eta_min
    new_personal_factor = (EMA_ALPHA_KEEP * old_factor) + (EMA_ALPHA_UPDATE * observed_factor)

  Alpha = 0.2 means each trip contributes 20% weight — new factor blends in
  gradually so a single outlier trip doesn't skew the model.

  Constraints:
    - Minimum 5-minute trip duration to avoid noise from micro-movements.
    - personal_factor clamped to [0.6, 1.8] to prevent runaway drift.
    - google_eta_min must be > 0 to avoid division errors.
"""

from __future__ import annotations

from typing import Optional
from sqlalchemy.orm import Session

from app.models.entities import Driver, Trip
from app.services.external_context import external_context

# Exponential moving average weight for new observations.
# 0.2 = each trip contributes 20% — blends in gradually over ~15 trips.
EMA_ALPHA_UPDATE = 0.2
EMA_ALPHA_KEEP = 1.0 - EMA_ALPHA_UPDATE

# Clamp bounds — prevent extreme drift from bad GPS or outlier sessions.
PERSONAL_FACTOR_MIN = 0.60
PERSONAL_FACTOR_MAX = 1.80

# Minimum trip duration to include in personal_factor update.
# Trips under 5 minutes are noisy (stop-start, GPS jitter).
MIN_TRIP_MINUTES = 5.0


def _get_google_eta_min(trip: Trip) -> Optional[float]:
    """
    Derive Google's traffic-aware ETA for the trip using origin → destination.
    Returns None if GPS coords are missing or the directions call fails.
    """
    if not all([trip.origin_lat, trip.origin_lng, trip.dest_lat, trip.dest_lng]):
        return None
    if trip.origin_lat == trip.dest_lat and trip.origin_lng == trip.dest_lng:
        return None

    try:
        result = external_context.directions(
            origin={"lat": trip.origin_lat, "lng": trip.origin_lng},
            destination={"lat": trip.dest_lat, "lng": trip.dest_lng},
        )
        eta = result.get("duration_traffic_min")
        return float(eta) if eta and float(eta) > 0 else None
    except Exception:
        return None


def update_personal_factor_from_trip(
    db: Session,
    trip: Trip,
    google_eta_min: Optional[float] = None,
) -> dict:
    """
    Called when a trip closes. Computes observed_factor from actual vs predicted
    travel time and applies an EMA update to driver.personal_factor.

    Args:
        db:             Active SQLAlchemy session.
        trip:           The closed Trip ORM instance (ended_at must be set).
        google_eta_min: Pre-computed Google ETA in minutes. If None, this
                        function will attempt to derive it from trip GPS coords.

    Returns:
        dict with update details (for logging / NudgeEvent payload).
    """
    if not trip.driver_id or not trip.ended_at or not trip.started_at:
        return {"status": "skipped", "reason": "missing_driver_or_timestamps"}

    actual_min = (trip.ended_at - trip.started_at).total_seconds() / 60.0
    if actual_min < MIN_TRIP_MINUTES:
        return {"status": "skipped", "reason": "trip_too_short", "actual_min": round(actual_min, 1)}

    # Use provided ETA or derive from GPS coords via Google Directions.
    eta = google_eta_min or _get_google_eta_min(trip)
    if not eta:
        return {"status": "skipped", "reason": "no_google_eta_available"}

    observed_factor = actual_min / eta

    # Clamp observed factor before EMA — single extreme trip shouldn't skew model.
    observed_factor = max(PERSONAL_FACTOR_MIN, min(PERSONAL_FACTOR_MAX, observed_factor))

    driver: Driver | None = db.get(Driver, trip.driver_id)
    if not driver:
        return {"status": "skipped", "reason": "driver_not_found"}

    old_factor = float(driver.personal_factor or 1.10)
    new_factor = (EMA_ALPHA_KEEP * old_factor) + (EMA_ALPHA_UPDATE * observed_factor)

    # Clamp final value.
    new_factor = round(max(PERSONAL_FACTOR_MIN, min(PERSONAL_FACTOR_MAX, new_factor)), 4)

    driver.personal_factor = new_factor
    db.flush()  # caller commits — keeps transaction ownership with the caller.

    return {
        "status": "updated",
        "driver_id": trip.driver_id,
        "driver_code": driver.driver_code,
        "actual_min": round(actual_min, 1),
        "google_eta_min": round(eta, 1),
        "observed_factor": round(observed_factor, 4),
        "old_personal_factor": old_factor,
        "new_personal_factor": new_factor,
    }
