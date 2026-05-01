from __future__ import annotations

from datetime import timedelta

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models import Driver, DriverBehaviorSnapshot, Telemetry


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
    }
