from __future__ import annotations

from typing import Any

from app.services.external_context import external_context
from app.services.wait_time_estimator import estimate_wait_window


def choose_charging_option(driver: dict[str, Any], order: dict[str, Any]) -> dict[str, Any]:
    driver_location = driver["location"]
    restaurant_location = order["restaurant_location"]
    customer_location = order.get("customer_location", restaurant_location)
    soc = float(driver.get("soc", 0.0))
    delivery_distance = float(order.get("delivery_distance_km", 0.0))
    prep_min = float(order.get("restaurant_wait_min", 0.0))

    wait_window = estimate_wait_window(driver_location, restaurant_location, prep_min)
    chargers_at_destination = external_context.nearest_chargers(
        restaurant_location["lat"], restaurant_location["lng"], radius_m=500
    )
    chargers_near_driver = external_context.nearest_chargers(driver_location["lat"], driver_location["lng"], radius_m=300)
    delivery_range_needed = delivery_distance * 1.25

    if chargers_at_destination and wait_window["chargeable_min"] >= 10:
        chosen = "OPTION_A"
        message = (
            f"Charge at destination during wait. Nearest charger: {chargers_at_destination[0]['name']} "
            f"({chargers_at_destination[0]['distance_m']}m)."
        )
        selected_charger = chargers_at_destination[0]
    elif soc < 25 and chargers_near_driver:
        charger = chargers_near_driver[0]
        detour = external_context.directions(driver_location, {"lat": charger["lat"], "lng": charger["lng"]})
        detour_penalty_min = detour["duration_traffic_min"] * 2
        if detour_penalty_min < wait_window["total_window_min"]:
            chosen = "OPTION_B"
            message = f"Detour to nearby charger before pickup. Detour penalty ~{detour_penalty_min:.1f} min."
            selected_charger = charger
        else:
            chosen = "OPTION_C"
            message = "Deliver directly. Detour is not worth the current wait window."
            selected_charger = None
    else:
        chosen = "OPTION_C"
        message = "Deliver directly. Current SOC/range is acceptable or no charger is nearby."
        selected_charger = None

    return {
        "chosen_option": chosen,
        "message": message,
        "selected_charger": selected_charger,
        "wait_window": wait_window,
        "delivery_range_needed_km": round(delivery_range_needed, 2),
        "customer_location": customer_location,
        "chargers_at_destination": chargers_at_destination[:3],
        "chargers_near_driver": chargers_near_driver[:3],
    }
