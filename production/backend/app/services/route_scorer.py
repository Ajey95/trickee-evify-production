from __future__ import annotations

from datetime import datetime, timedelta

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


def score_route(route_key: str, speed_kmh: float, personal_factor: float = 1.1, soc_start: float = 80.0) -> dict:
    route = SURAT_ROUTES[route_key]
    distance = route["distance_km"]
    travel_min = (distance / max(speed_kmh, 1.0)) * 60.0
    personalized_min = travel_min * personal_factor
    junction_penalty = (route["signals"] / distance) * 0.08
    smooth_sag_penalty = route["sag"] * 0.40
    speed_factor = 1.0 + max(0.0, (70.0 - speed_kmh) / 70.0) * 0.3
    energy_kwh = BASE_RATE * distance * (1 + smooth_sag_penalty + junction_penalty) * speed_factor
    soc_end = max(2.0, soc_start - (energy_kwh / 1.824) * 100.0)
    composite = 0.40 * (personalized_min / 50.0) + 0.35 * (energy_kwh / 2.0) + 0.25 * (1 - route["pref"])
    return {
        "route": route_key,
        "name": route["name"],
        "distance_km": distance,
        "avg_speed_kmh": speed_kmh,
        "personalized_eta_min": round(personalized_min, 1),
        "energy_kwh": round(energy_kwh, 3),
        "soc_start": round(soc_start, 1),
        "soc_end": round(soc_end, 1),
        "driver_preference_score": route["pref"],
        "stop_and_go_index": route["sag"],
        "signals": route["signals"],
        "composite_score": round(composite, 4),
    }


def route_scores(day_type: str, slot: str, personal_factor: float = 1.1, soc_start: float = 80.0) -> dict:
    speeds = TRAFFIC_SPEEDS.get((day_type, slot), TRAFFIC_SPEEDS[("weekday", "morning")])
    scored = [score_route(key, speed, personal_factor, soc_start) for key, speed in speeds.items()]
    scored.sort(key=lambda item: item["composite_score"])
    best = scored[0]
    arrival = datetime.utcnow().replace(hour=9 if slot == "morning" else 18, minute=0, second=0, microsecond=0)
    buffer_min = 25 if best["avg_speed_kmh"] / FREE_FLOW_SPEED < 0.75 else 10
    depart = arrival - timedelta(minutes=best["personalized_eta_min"] + buffer_min)
    return {
        "ranked_routes": scored,
        "recommended_route": best,
        "fallback_route": scored[1] if len(scored) > 1 else None,
        "nudge": {
            "recommended_departure": depart.strftime("%H:%M"),
            "buffer_applied_min": buffer_min,
            "message": f"Take {best['name']}. Leave at {depart.strftime('%H:%M')} with {buffer_min} min buffer.",
        },
    }
