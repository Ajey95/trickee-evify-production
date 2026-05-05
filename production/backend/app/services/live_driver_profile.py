from __future__ import annotations

import time
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models import Driver, NudgeEvent, Telemetry, Vehicle, WaitEvent
from app.services.external_context import external_context

SOC_RISE_CHARGE_THRESHOLD = 2.0
LOW_SOC_THRESHOLD = 20.0
STOP_SPEED_KMPH = 3.0
BAD_DATA_VEHICLE_CODES = {"GJ05PZ1856"}

# Cache for bad vehicle IDs: the set of excluded codes is a constant so
# results are stable; 5-minute TTL prevents accumulation of stale DB rows.
_BAD_VEHICLE_IDS_TTL_SECONDS = 300
_bad_vehicle_ids_cache: tuple[float, list[str]] = (0.0, [])

BASELINE_PROFILES: dict[str, dict[str, Any]] = {
    "D2": {
        "source": "evify_28_04",
        "avg_speed_kmph": 12.4,
        "regen_ratio_pct": 18.2,
        "low_soc_events": 2355,
        "stop_wait_pct": 38.0,
        "peak_shift": "evening",
        "thermal_load": "medium",
        "battery_risk": "medium",
        "pattern_note": "Busy stop-start rider with late charging tendency.",
    },
    "D3": {
        "source": "evify_28_04",
        "avg_speed_kmph": 11.9,
        "regen_ratio_pct": 24.9,
        "low_soc_events": 2714,
        "stop_wait_pct": 11.0,
        "peak_shift": "afternoon",
        "thermal_load": "medium",
        "battery_risk": "medium",
        "pattern_note": "Best regen baseline but still has frequent low-SOC events.",
    },
    "D4": {
        "source": "evify_28_04",
        "avg_speed_kmph": 11.9,
        "regen_ratio_pct": 18.5,
        "low_soc_events": 908,
        "stop_wait_pct": 53.0,
        "peak_shift": "late_evening",
        "thermal_load": "low",
        "battery_risk": "low",
        "pattern_note": "Strong SOC manager with large stop-window charging opportunity.",
    },
    "D5": {
        "source": "evify_28_04",
        "avg_speed_kmph": 11.7,
        "regen_ratio_pct": 23.7,
        "low_soc_events": 138,
        "stop_wait_pct": 39.0,
        "peak_shift": "afternoon",
        "thermal_load": "high",
        "battery_risk": "low",
        "pattern_note": "Fastest and hottest baseline rider with good regen and SOC habits.",
    },
}


def _valid_gps(row: Telemetry) -> bool:
    return row.lat is not None and row.lng is not None and row.lat != 0 and row.lng != 0


def _avg(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _baseline_for(driver: Driver) -> dict[str, Any] | None:
    return BASELINE_PROFILES.get((driver.driver_code or "").upper())


def _bad_vehicle_ids(db: Session) -> list[str]:
    global _bad_vehicle_ids_cache
    cached_at, cached_result = _bad_vehicle_ids_cache
    if time.monotonic() - cached_at < _BAD_VEHICLE_IDS_TTL_SECONDS:
        return cached_result
    result = [
        vehicle.id
        for vehicle in db.query(Vehicle).filter(Vehicle.vehicle_code.in_(BAD_DATA_VEHICLE_CODES)).all()
    ]
    _bad_vehicle_ids_cache = (time.monotonic(), result)
    return result


def _telemetry_base_query(db: Session, driver: Driver):
    query = db.query(Telemetry).filter(Telemetry.driver_id == driver.id)
    bad_ids = _bad_vehicle_ids(db)
    if bad_ids:
        query = query.filter(Telemetry.vehicle_id.notin_(bad_ids))
    return query


def _valid_rows(rows: list[Telemetry]) -> list[Telemetry]:
    return [row for row in rows if row.vehicle_id]


def _time_context(latest: Telemetry, baseline: dict[str, Any] | None = None) -> dict[str, Any]:
    recorded_at = latest.recorded_at
    hour = recorded_at.hour
    if 11 <= hour < 15:
        slot = "lunch_peak"
    elif 19 <= hour < 23:
        slot = "dinner_peak"
    elif hour >= 23 or hour < 5:
        slot = "late_night"
    else:
        slot = "regular"
    month = recorded_at.month
    if month in {3, 4, 5, 6}:
        season = "summer"
    elif month in {7, 8, 9}:
        season = "monsoon"
    elif month in {12, 1, 2}:
        season = "winter"
    else:
        season = "post_monsoon"
    return {
        "date": recorded_at.date().isoformat(),
        "month": month,
        "season": season,
        "day_of_week": recorded_at.strftime("%A"),
        "hour": hour,
        "slot": slot,
        "is_weekend": recorded_at.weekday() >= 5,
        "holiday_flag": False,
        "festival_event_flag": False,
        "event_source": "not_configured",
        "driver_usual_active_window": baseline.get("peak_shift") if baseline else None,
    }


def _classify_thermal(avg_temp: float, max_temp: float) -> str:
    if max_temp >= 80 or avg_temp >= 58:
        return "high"
    if max_temp >= 72 or avg_temp >= 52:
        return "medium"
    return "low"


def _profile_action(latest: Telemetry | None, battery_risk_score: int, nearest_charger: dict[str, Any] | None) -> str:
    if not latest:
        return "Awaiting live telemetry"
    if latest.soc <= 15:
        if nearest_charger:
            return f"Charge now: nearest charger is {nearest_charger['distance_m']}m away"
        return "Charge now: SOC is critically low"
    if latest.soc <= LOW_SOC_THRESHOLD:
        return "Stay near charging options before accepting long orders"
    if latest.speed <= STOP_SPEED_KMPH and latest.ignition_on and latest.soc < 35 and nearest_charger:
        return f"Use this stop window to top up near {nearest_charger['name']}"
    if battery_risk_score >= 65:
        return "Drive smooth and avoid high-current bursts this shift"
    return "Continue delivery; profile is within normal operating range"


def _confidence(sample_count: int, gps_coverage_pct: float, baseline: dict[str, Any] | None) -> dict[str, Any]:
    if sample_count >= 500 and gps_coverage_pct >= 70:
        score = 0.9
        label = "high"
    elif sample_count >= 50:
        score = 0.72 if gps_coverage_pct >= 40 else 0.62
        label = "medium"
    elif baseline:
        score = 0.48
        label = "baseline_seed"
    else:
        score = 0.2
        label = "low"
    return {"score": score, "label": label}


def _cluster_zones(rows: list[Telemetry], max_zones: int = 5) -> list[dict[str, Any]]:
    buckets: dict[tuple[float, float], dict[str, Any]] = {}
    for row in rows:
        if not _valid_gps(row):
            continue
        key = (round(float(row.lat), 3), round(float(row.lng), 3))
        bucket = buckets.setdefault(
            key,
            {
                "center": {"lat": key[0], "lng": key[1]},
                "sample_count": 0,
                "latest_seen_at": row.recorded_at,
            },
        )
        bucket["sample_count"] += 1
        if row.recorded_at > bucket["latest_seen_at"]:
            bucket["latest_seen_at"] = row.recorded_at
    zones = sorted(buckets.values(), key=lambda item: item["sample_count"], reverse=True)[:max_zones]
    for zone in zones:
        zone["latest_seen_at"] = zone["latest_seen_at"].isoformat()
    return zones


def detect_soc_rise_charging(prev: Telemetry | None, row: Telemetry) -> dict[str, Any] | None:
    if not prev:
        return None
    delta_soc = row.soc - prev.soc
    if delta_soc < SOC_RISE_CHARGE_THRESHOLD:
        return None
    minutes = max((row.recorded_at - prev.recorded_at).total_seconds() / 60.0, 0.0)
    if minutes > 180:
        return None
    return {
        "detected": True,
        "delta_soc": round(delta_soc, 2),
        "from_soc": round(prev.soc, 2),
        "to_soc": round(row.soc, 2),
        "duration_min": round(minutes, 1),
        "detected_at": row.recorded_at.isoformat(),
        "method": "soc_rise",
    }


def record_soc_rise_charging_event(db: Session, row: Telemetry, prev: Telemetry | None) -> NudgeEvent | None:
    detection = detect_soc_rise_charging(prev, row)
    if not detection or not row.driver_id:
        return None
    existing = (
        db.query(NudgeEvent)
        .filter(
            NudgeEvent.driver_id == row.driver_id,
            NudgeEvent.vehicle_id == row.vehicle_id,
            NudgeEvent.nudge_type == "charging_detected",
            NudgeEvent.created_at >= row.recorded_at,
        )
        .first()
    )
    if existing:
        return None
    event = NudgeEvent(
        driver_id=row.driver_id,
        vehicle_id=row.vehicle_id,
        nudge_type="charging_detected",
        channel="system",
        message=f"Charging detected from SOC rise: +{detection['delta_soc']}% SOC.",
        payload=detection,
        status="detected",
        created_at=row.recorded_at if isinstance(row.recorded_at, datetime) else None,
    )
    db.add(event)
    return event


def live_driver_profile(db: Session, driver: Driver, window_minutes: int = 7 * 24 * 60) -> dict[str, Any]:
    baseline = _baseline_for(driver)
    latest = (
        _telemetry_base_query(db, driver)
        .order_by(desc(Telemetry.recorded_at))
        .first()
    )
    if not latest:
        return {
            "driver_id": driver.id,
            "driver_code": driver.driver_code,
            "sample_count": 0,
            "profile_status": "baseline_seed" if baseline else "no_live_telemetry",
            "baseline_seed": baseline,
            "excluded_vehicle_codes": sorted(BAD_DATA_VEHICLE_CODES),
            "range_confidence": _confidence(0, 0.0, baseline),
            "next_best_action": (
                f"Use {baseline['peak_shift']} baseline profile until live telemetry arrives"
                if baseline
                else "Awaiting live telemetry"
            ),
        }

    since = latest.recorded_at - timedelta(minutes=window_minutes)
    rows = (
        _telemetry_base_query(db, driver)
        .filter(Telemetry.recorded_at >= since)
        .order_by(desc(Telemetry.recorded_at))
        .limit(2000)
        .all()
    )
    ordered = _valid_rows(list(reversed(rows)))
    speeds = [row.speed for row in ordered]
    currents = [row.current for row in ordered]
    temps = [row.temp_max for row in ordered]
    valid_gps_rows = [row for row in ordered if _valid_gps(row)]
    low_soc_rows = [row for row in ordered if row.soc < LOW_SOC_THRESHOLD]
    stopped_rows = [row for row in ordered if row.speed <= STOP_SPEED_KMPH]
    regen_ratio = sum(1 for row in ordered if row.regen_status) / len(ordered)
    throttle_ratio = sum(1 for row in ordered if row.throttle_status) / len(ordered)
    soc_rise_events = [
        detection
        for prev, current in zip(ordered, ordered[1:])
        if (detection := detect_soc_rise_charging(prev, current))
    ]

    gps_coverage_pct = len(valid_gps_rows) / len(ordered) * 100
    low_soc_pct = len(low_soc_rows) / len(ordered) * 100
    stop_wait_pct = len(stopped_rows) / len(ordered) * 100
    avg_temp = _avg(temps)
    max_temp = max(temps) if temps else 0.0
    thermal_load = _classify_thermal(avg_temp, max_temp)

    battery_risk_score = min(
        100,
        round(
            low_soc_pct * 1.1
            + max(0.0, 25.0 - regen_ratio * 100) * 0.7
            + max(0.0, avg_temp - 48.0) * 1.5
            + max(0.0, _avg(currents) - 8.0) * 4.0
        ),
    )

    operating_zone = None
    if valid_gps_rows:
        lats = [float(row.lat) for row in valid_gps_rows if row.lat is not None]
        lngs = [float(row.lng) for row in valid_gps_rows if row.lng is not None]
        operating_zone = {
            "center": {"lat": round(_avg(lats), 6), "lng": round(_avg(lngs), 6)},
            "bounds": {
                "min_lat": round(min(lats), 6),
                "max_lat": round(max(lats), 6),
                "min_lng": round(min(lngs), 6),
                "max_lng": round(max(lngs), 6),
            },
        }

    nearest_charger = None
    external = None
    if _valid_gps(latest):
        chargers = external_context.nearest_chargers(float(latest.lat), float(latest.lng), radius_m=750)
        nearest_charger = chargers[0] if chargers else None
        external = external_context.route_context({"lat": float(latest.lat), "lng": float(latest.lng)})

    wait_events = (
        db.query(WaitEvent)
        .filter(WaitEvent.driver_id == driver.id, WaitEvent.started_at >= since)
        .order_by(desc(WaitEvent.started_at))
        .limit(200)
        .all()
    )
    wait_type_counts: dict[str, int] = {}
    for event in wait_events:
        wait_type_counts[event.wait_type] = wait_type_counts.get(event.wait_type, 0) + 1

    return {
        "driver_id": driver.id,
        "driver_code": driver.driver_code,
        "window_minutes": window_minutes,
        "sample_count": len(ordered),
        "profile_status": "live" if len(ordered) >= 10 else "live_with_baseline",
        "baseline_seed": baseline,
        "excluded_vehicle_codes": sorted(BAD_DATA_VEHICLE_CODES),
        "range_confidence": _confidence(len(ordered), gps_coverage_pct, baseline),
        "latest": {
            "vehicle_id": latest.vehicle_id,
            "recorded_at": latest.recorded_at.isoformat(),
            "soc": latest.soc,
            "soh": latest.soh,
            "speed": latest.speed,
            "current": latest.current,
            "battery_voltage": latest.battery_voltage,
            "temp_max": latest.temp_max,
            "cell_imbalance_mv": latest.cell_imbalance_mv,
            "voltage_sag_v": latest.voltage_sag_v,
            "lat": latest.lat,
            "lng": latest.lng,
            "ignition_on": latest.ignition_on,
            "charge_plug": latest.charge_plug,
        },
        "behavior": {
            "avg_speed_kmph": round(_avg(speeds), 2),
            "baseline_avg_speed_kmph": baseline.get("avg_speed_kmph") if baseline else None,
            "avg_current_a": round(_avg(currents), 2),
            "regen_ratio_pct": round(regen_ratio * 100, 1),
            "baseline_regen_ratio_pct": baseline.get("regen_ratio_pct") if baseline else None,
            "throttle_ratio_pct": round(throttle_ratio * 100, 1),
            "stop_wait_pct": round(stop_wait_pct, 1),
            "baseline_stop_wait_pct": baseline.get("stop_wait_pct") if baseline else None,
            "thermal_load": thermal_load,
            "avg_temp_c": round(avg_temp, 1),
            "max_temp_c": round(max_temp, 1),
        },
        "battery": {
            "low_soc_events": len(low_soc_rows),
            "low_soc_pct": round(low_soc_pct, 1),
            "battery_risk_score": battery_risk_score,
            "risk_level": "high" if battery_risk_score >= 70 else "medium" if battery_risk_score >= 40 else "low",
            "warning_soc_threshold": 35 if battery_risk_score >= 70 else 30 if battery_risk_score >= 40 else 25,
        },
        "charging": {
            "soc_rise_events": len(soc_rise_events),
            "last_soc_rise_event": soc_rise_events[-1] if soc_rise_events else None,
            "charge_plug_rows": sum(1 for row in ordered if row.charge_plug),
            "nearest_charger": nearest_charger,
        },
        "location": {
            "gps_coverage_pct": round(gps_coverage_pct, 1),
            "operating_zone": operating_zone,
            "frequent_stop_zones": _cluster_zones(stopped_rows),
            "low_soc_zones": _cluster_zones(low_soc_rows),
        },
        "waits": {
            "recent_event_count": len(wait_events),
            "type_counts": wait_type_counts,
            "active_wait": next((event.wait_type for event in wait_events if event.ended_at is None), None),
        },
        "external_context": {
            "time": _time_context(latest, baseline),
            **(external or {}),
        },
        "next_best_action": _profile_action(latest, battery_risk_score, nearest_charger),
    }
