from __future__ import annotations

from typing import Any


def assign_order(available_drivers: list[dict[str, Any]], order: dict[str, Any]) -> dict[str, Any]:
    if not available_drivers:
        return {"assigned_driver": None, "ranked_drivers": [], "reason": "No available drivers"}

    wait_time = float(order.get("restaurant_wait_min", 0.0))
    delivery_distance = float(order.get("delivery_distance_km", 0.0))
    safety_distance = delivery_distance * 1.3
    ranked = []

    for driver in available_drivers:
        soc = float(driver.get("soc", 0.0))
        current_range = float(driver.get("current_range_km", 0.0))
        efficiency = float(driver.get("efficiency_score", 0.5))
        distance_penalty = float(driver.get("distance_to_restaurant_km", 0.0)) * 0.08
        wait_charge_benefit = max(wait_time - 10.0, 0.0) / 30.0

        if wait_time >= 15 and current_range >= safety_distance:
            score = ((100.0 - soc) / 100.0) * 0.70 + wait_charge_benefit * 0.25 - distance_penalty
            strategy = "low_soc_wait_time_charging"
        else:
            score = efficiency * 0.75 + (current_range >= safety_distance) * 0.20 - distance_penalty
            strategy = "highest_efficiency"

        ranked.append(
            {
                **driver,
                "assignment_score": round(float(score), 4),
                "strategy": strategy,
                "range_safe": current_range >= safety_distance,
                "required_range_km": round(safety_distance, 2),
            }
        )

    ranked.sort(key=lambda item: item["assignment_score"], reverse=True)
    return {
        "assigned_driver": ranked[0],
        "ranked_drivers": ranked,
        "reason": ranked[0]["strategy"],
    }
