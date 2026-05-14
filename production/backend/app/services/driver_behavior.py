from __future__ import annotations

from datetime import timedelta

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models import Driver, DriverBehaviorSnapshot, Telemetry
from app.services.live_driver_profile import classify_driver_archetype


def compute_driver_behavior(db: Session, driver: Driver, window_minutes: int = 30, persist: bool = True) -> dict:
    latest = (
        db.query(Telemetry)
        .filter(Telemetry.driver_id == driver.id)
        .order_by(desc(Telemetry.recorded_at))
        .first()
    )
    if not latest:
        return {
            "driver_id": driver.id,
            "window_minutes": window_minutes,
            "sample_count": 0,
            "avg_current_30m": driver.avg_current_30m,
            "avg_speed_30m": driver.avg_speed_30m,
            "regen_ratio_30m": driver.avg_regen_ratio,
            "throttle_var_30m": driver.avg_throttle_variance,
            "style_label": driver.style_label,
        }

    since = latest.recorded_at - timedelta(minutes=window_minutes)
    rows = (
        db.query(Telemetry)
        .filter(Telemetry.driver_id == driver.id, Telemetry.recorded_at >= since)
        .order_by(Telemetry.recorded_at)
        .all()
    )
    if not rows:
        rows = [latest]

    currents = [row.current for row in rows]
    speeds = [row.speed for row in rows]
    regen_ratio = sum(1 for row in rows if row.regen_status) / len(rows)
    throttle_values = [1.0 if row.throttle_status else 0.0 for row in rows]
    throttle_mean = sum(throttle_values) / len(throttle_values)
    throttle_var = sum((value - throttle_mean) ** 2 for value in throttle_values) / len(throttle_values)
    avg_current = sum(currents) / len(currents)
    avg_speed = sum(speeds) / len(speeds)
    low_soc_pct = sum(1 for row in rows if row.soc <= 20) / len(rows) * 100.0
    stop_wait_pct = sum(1 for row in rows if row.speed <= 3 and not row.charge_plug) / len(rows) * 100.0
    avg_temp = sum(row.temp_max for row in rows) / len(rows)
    thermal_load = "high" if avg_temp >= 58 else "medium" if avg_temp >= 48 else "low"
    battery_risk_score = int(
        min(
            100,
            (low_soc_pct * 1.6)
            + (max(avg_current - 8, 0) * 6)
            + (max(avg_temp - 48, 0) * 2)
            + ((1 - regen_ratio) * 12),
        )
    )
    gps_rows = [row for row in rows if row.lat is not None and row.lng is not None and row.lat != 0 and row.lng != 0]
    gps_coverage_pct = len(gps_rows) / len(rows) * 100.0
    soc_rise_events = sum(
        1
        for previous, current in zip(rows, rows[1:])
        if current.soc - previous.soc >= 2.0
    )
    archetype = classify_driver_archetype(
        driver=driver,
        sample_count=len(rows),
        avg_current_a=avg_current,
        regen_ratio_pct=regen_ratio * 100.0,
        low_soc_pct=low_soc_pct,
        stop_wait_pct=stop_wait_pct,
        thermal_load=thermal_load,
        avg_temp_c=avg_temp,
        battery_risk_score=battery_risk_score,
        soc_rise_event_count=soc_rise_events,
        gps_coverage_pct=gps_coverage_pct,
    )

    if avg_current > 8 or throttle_var > 0.20:
        style = "Aggressive"
    elif regen_ratio > 0.30 and avg_current < 6:
        style = "Efficient"
    elif avg_speed < 18:
        style = "Cautious"
    else:
        style = "Smooth"

    if persist:
        avg_current = round(avg_current, 3)
        avg_speed = round(avg_speed, 3)
        regen_ratio = round(regen_ratio, 3)
        throttle_var = round(throttle_var, 3)
        driver.avg_current_30m = avg_current
        driver.avg_speed_30m = avg_speed
        driver.avg_regen_ratio = regen_ratio
        driver.avg_throttle_variance = throttle_var
        driver.style_label = style
        db.add(
            DriverBehaviorSnapshot(
                driver_id=driver.id,
                window_minutes=window_minutes,
                sample_count=len(rows),
                avg_current_30m=avg_current,
                avg_speed_30m=avg_speed,
                regen_ratio_30m=regen_ratio,
                throttle_var_30m=throttle_var,
                style_label=style,
                archetype_label=archetype.get("label"),
                archetype_confidence=archetype.get("confidence"),
                archetype_source=archetype.get("source"),
                archetype_payload=archetype,
            )
        )
        db.commit()
        db.refresh(driver)

    return {
        "driver_id": driver.id,
        "window_minutes": window_minutes,
        "sample_count": len(rows),
        "avg_current_30m": round(avg_current, 3),
        "avg_speed_30m": round(avg_speed, 3),
        "regen_ratio_30m": round(regen_ratio, 3),
        "throttle_var_30m": round(throttle_var, 3),
        "style_label": style,
        "archetype": archetype,
    }
