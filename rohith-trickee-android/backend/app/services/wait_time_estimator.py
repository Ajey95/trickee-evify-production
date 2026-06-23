from __future__ import annotations

from typing import Any

from app.services.external_context import external_context
from app.services.wait_classifier import classify_wait_snapshot


def estimate_wait_window(
    driver_location: dict[str, float],
    restaurant_location: dict[str, float],
    prep_min: float,
    handover_buffer_min: float = 2.0,
    *,
    current_speed_kmph: float | None = None,
    ignition_on: bool | None = None,
    charge_plug: bool | None = None,
    current_stop_duration_min: float = 0.0,
) -> dict[str, Any]:
    directions = external_context.directions(driver_location, restaurant_location)
    travel_min = directions["duration_traffic_min"]
    classification = classify_wait_snapshot(
        location=driver_location,
        speed_kmph=current_speed_kmph,
        ignition_on=ignition_on,
        charge_plug=charge_plug,
        restaurant_location=restaurant_location,
    )
    observed_stop_min = max(0.0, float(current_stop_duration_min))
    total_window_min = float(travel_min) + float(prep_min) + float(handover_buffer_min)
    planned_chargeable_min = max(0.0, float(prep_min) + float(handover_buffer_min))
    wait_type = classification["wait_type"]

    if wait_type == "restaurant_wait":
        chargeable_min = observed_stop_min + planned_chargeable_min
        useful_for_charging = chargeable_min >= 8.0
    elif wait_type == "charging_wait":
        chargeable_min = observed_stop_min
        useful_for_charging = True
    else:
        chargeable_min = planned_chargeable_min
        useful_for_charging = wait_type in {"approach_window", "restaurant_wait"} and chargeable_min >= 8.0

    return {
        "travel_min": round(travel_min, 1),
        "prep_min": round(float(prep_min), 1),
        "handover_buffer_min": round(float(handover_buffer_min), 1),
        "observed_stop_min": round(observed_stop_min, 1),
        "total_window_min": round(total_window_min, 1),
        "chargeable_min": round(chargeable_min, 1),
        "planned_chargeable_min": round(planned_chargeable_min, 1),
        "wait_type": wait_type,
        "useful_for_charging": useful_for_charging,
        "classification": classification,
        "directions": directions,
    }
