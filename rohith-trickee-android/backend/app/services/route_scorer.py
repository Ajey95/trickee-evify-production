from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from app.services.charge_plan import build_destination_charge_plan
from app.services.geo import haversine_km

SURAT_ROUTES = {
    "A": {"name": "Surat-Dumas Road", "distance_km": 8.5, "signals": 11, "sag": 0.55, "pref": 0.55},
    "B": {"name": "Althan Bypass", "distance_km": 9.8, "signals": 6, "sag": 0.30, "pref": 0.85},
    "C": {"name": "Adajan Road", "distance_km": 10.2, "signals": 8, "sag": 0.45, "pref": 0.50},
}

TRAFFIC_SPEEDS = {
    ("weekday", "morning"): {"A": 22, "B": 34, "C": 28},
    ("weekday", "evening"): {"A": 18, "B": 28, "C": 22},
    ("weekend", "brunch"): {"A": 35, "B": 45, "C": 38},
    ("weekend", "night"): {"A": 55, "B": 60, "C": 52},
}

BASE_RATE = 0.055
FREE_FLOW_SPEED = 50.0


def _has_coords(point: dict[str, float] | None) -> bool:
    return isinstance(point, dict) and isinstance(point.get("lat"), (int, float)) and isinstance(point.get("lng"), (int, float))


def _dynamic_routes(
    origin: dict[str, float],
    destination: dict[str, float],
    origin_label: str | None = None,
    dest_label: str | None = None,
) -> dict[str, dict[str, Any]]:
    direct_km = max(0.5, haversine_km(origin["lat"], origin["lng"], destination["lat"], destination["lng"]) * 1.28)
    origin_name = origin_label or "Selected origin"
    destination_name = dest_label or "selected destination"
    signal_base = max(3, int(round(direct_km * 1.25)))
    return {
        "A": {
            "name": f"{origin_name} to {destination_name} direct",
            "distance_km": round(direct_km, 1),
            "signals": signal_base + 2,
            "sag": 0.55,
            "pref": 0.55,
        },
        "B": {
            "name": "EV-Safe Bypass",
            "distance_km": round(direct_km * 1.10, 1),
            "signals": max(2, signal_base - 3),
            "sag": 0.30,
            "pref": 0.85,
        },
        "C": {
            "name": "Charger backup route",
            "distance_km": round(direct_km * 1.16, 1),
            "signals": max(2, signal_base - 1),
            "sag": 0.40,
            "pref": 0.70,
        },
    }


def score_route(
    route_key: str,
    speed_kmh: float,
    personal_factor: float = 1.1,
    soc_start: float = 80.0,
    route_defs: dict[str, dict[str, Any]] | None = None,
) -> dict:
    route_catalog = route_defs or SURAT_ROUTES
    route = route_catalog[route_key]
    distance = route["distance_km"]
    safe_soc_start = max(0.0, min(100.0, soc_start))
    travel_min = (distance / max(speed_kmh, 1.0)) * 60.0
    personalized_min = travel_min * personal_factor
    junction_penalty = (route["signals"] / distance) * 0.08
    smooth_sag_penalty = route["sag"] * 0.40
    speed_factor = 1.0 + max(0.0, (70.0 - speed_kmh) / 70.0) * 0.3
    energy_kwh = BASE_RATE * distance * (1 + smooth_sag_penalty + junction_penalty) * speed_factor
    soc_required = (energy_kwh / 1.824) * 100.0
    soc_end = safe_soc_start - soc_required
    charge_plan = build_destination_charge_plan(
        current_soc_pct=safe_soc_start,
        soc_required_pct=soc_required,
    )
    is_feasible = safe_soc_start > 0 and soc_end >= 10.0
    feasibility_reason = None
    if safe_soc_start <= 0:
        feasibility_reason = "SOC is 0%; charge before route scoring."
    elif soc_end < 0:
        feasibility_reason = "Not enough SOC to complete this route."
    elif soc_end < 10:
        feasibility_reason = "Route leaves less than 10% SOC buffer."
    composite = (
        0.40 * (personalized_min / 50.0)
        + 0.35 * (energy_kwh / 2.0)
        + 0.25 * (1 - route["pref"])
        + (10.0 if not is_feasible else 0.0)
    )
    return {
        "route": route_key,
        "name": route["name"],
        "distance_km": round(distance, 1),
        "avg_speed_kmh": speed_kmh,
        "personalized_eta_min": round(personalized_min, 1),
        "energy_kwh": round(energy_kwh, 3),
        "soc_start": round(safe_soc_start, 1),
        "soc_end": round(soc_end, 1),
        "soc_required_pct": round(soc_required, 1),
        "destination_charge_plan": charge_plan,
        "charge_minutes_required": charge_plan["charge_minutes"],
        "top_up_soc_required_pct": charge_plan["top_up_soc_pct"],
        "is_feasible": is_feasible,
        "feasibility_reason": feasibility_reason,
        "driver_preference_score": route["pref"],
        "stop_and_go_index": route["sag"],
        "signals": route["signals"],
        "composite_score": round(composite, 4),
    }


def route_scores(
    day_type: str,
    slot: str,
    personal_factor: float = 1.1,
    soc_start: float = 80.0,
    origin: dict[str, float] | None = None,
    destination: dict[str, float] | None = None,
    origin_label: str | None = None,
    dest_label: str | None = None,
) -> dict:
    route_defs = (
        _dynamic_routes(origin, destination, origin_label, dest_label)
        if _has_coords(origin) and _has_coords(destination)
        else SURAT_ROUTES
    )
    speeds = TRAFFIC_SPEEDS.get((day_type, slot), TRAFFIC_SPEEDS[("weekday", "morning")])
    scored = [score_route(key, speed, personal_factor, soc_start, route_defs) for key, speed in speeds.items()]
    scored.sort(key=lambda item: item["composite_score"])
    feasible_routes = [route for route in scored if route["is_feasible"]]
    all_infeasible = not feasible_routes
    best = feasible_routes[0] if feasible_routes else None
    best_informational = best or scored[0]
    arrival = datetime.utcnow().replace(hour=9 if slot == "morning" else 18, minute=0, second=0, microsecond=0)
    buffer_min = 25 if best_informational["avg_speed_kmh"] / FREE_FLOW_SPEED < 0.75 else 10
    depart = arrival - timedelta(minutes=best_informational["personalized_eta_min"] + buffer_min)
    return {
        "ranked_routes": scored,
        "recommended_route": best,
        "best_informational_route": best_informational,
        "fallback_route": (feasible_routes[1] if len(feasible_routes) > 1 else None),
        "all_routes_infeasible": all_infeasible,
        "route_status": "charge_required" if all_infeasible else "route_available",
        "route_source": "selected_points" if route_defs is not SURAT_ROUTES else "static_fallback",
        "nudge": {
            "recommended_departure": depart.strftime("%H:%M"),
            "buffer_applied_min": buffer_min,
            "message": (
                best_informational["destination_charge_plan"]["message"]
                if all_infeasible
                else f"Take {best_informational['name']}. Leave at {depart.strftime('%H:%M')} with {buffer_min} min buffer."
            ),
            "destination_charge_plan": best_informational["destination_charge_plan"],
        },
    }
