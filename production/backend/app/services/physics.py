from __future__ import annotations

from datetime import datetime

R0_BASE = 0.055
CAPACITY_WH = 1824.0


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def soc_to_ocv(soc: float) -> float:
    soc = clamp(float(soc), 0.0, 100.0)
    if soc <= 10:
        return 42.0 + soc * 0.20
    if soc <= 20:
        return 44.0 + (soc - 10) * 0.40
    if soc <= 90:
        return 48.0 + (soc - 20) * 0.08571
    return 54.0 + (soc - 90) * 0.44


def compute_r_internal_mohm(cycle_count: int, soh: float) -> float:
    r_age = R0_BASE * (1.0 + 0.003 * float(cycle_count or 0))
    r_soh = r_age * (1.0 + (100.0 - float(soh or 100.0)) / 200.0)
    return round(r_soh * 1000.0, 2)


def compute_derived_fields(
    *,
    soc: float,
    battery_voltage: float,
    current: float,
    temp_max: float,
    prev_temp_max: float | None,
    cycle_count: int,
    soh: float,
    recorded_at: datetime,
) -> dict[str, float | int]:
    power = float(battery_voltage) * float(current)
    return {
        "power": power,
        "power_density": round(power / CAPACITY_WH, 4),
        "temp_rise_rate": round(clamp(float(temp_max) - float(prev_temp_max), -5.0, 5.0), 4)
        if prev_temp_max is not None
        else 0.0,
        "voltage_sag_v": round(soc_to_ocv(soc) - float(battery_voltage), 3),
        "r_internal_mohm": compute_r_internal_mohm(cycle_count, soh),
        "minute_of_day": recorded_at.hour * 60 + recorded_at.minute,
        "day_of_week": recorded_at.weekday(),
    }


def compute_range_factors(
    *,
    soc: float,
    soh: float,
    temp_max: float,
    power_density: float,
    max_range_km: float,
) -> dict[str, float]:
    soh_factor = clamp(float(soh) / 100.0, 0.50, 1.05)
    thermal_factor = clamp(1.0 - max(0.0, (float(temp_max) - 30.0) / 100.0), 0.70, 1.0)
    aggression_factor = clamp(1.0 - min(0.25, abs(float(power_density)) * 1.8), 0.75, 1.0)
    usable_soc_factor = clamp(float(soc) / 100.0, 0.0, 1.0)
    dynamic_range_km = float(max_range_km) * usable_soc_factor * soh_factor * thermal_factor * aggression_factor
    return {
        "soh_factor": round(soh_factor, 4),
        "thermal_factor": round(thermal_factor, 4),
        "aggression_factor": round(aggression_factor, 4),
        "dynamic_range_km": round(dynamic_range_km, 2),
    }
