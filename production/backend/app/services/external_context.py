from __future__ import annotations

import time
from typing import Any

import httpx

from app.config import get_settings
from app.services.alert_service import CHARGERS
from app.services.geo import fallback_travel_minutes, haversine_km


class ExternalContextService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def weather(self, lat: float, lng: float) -> dict[str, Any]:
        if not self.settings.openweather_api_key:
            ambient_temp = round(30.0 + max(0.0, (lat - 21.0) * 2.0), 1)
            return {
                "source": "fallback",
                "ambient_temp_c": ambient_temp,
                "rain_mm_1h": 0.0,
                "humidity_pct": None,
                "wind_speed_mps": None,
                "heatwave_severity": "high" if ambient_temp >= 38 else "medium" if ambient_temp >= 34 else "low",
                "description": "No OpenWeather key configured",
            }

        url = "https://api.openweathermap.org/data/2.5/weather"
        params = {"lat": lat, "lon": lng, "appid": self.settings.openweather_api_key, "units": "metric"}
        try:
            with httpx.Client(timeout=self.settings.external_api_timeout_seconds) as client:
                resp = client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()
            return {
                "source": "openweather",
                "ambient_temp_c": data.get("main", {}).get("temp"),
                "rain_mm_1h": data.get("rain", {}).get("1h", 0.0),
                "humidity_pct": data.get("main", {}).get("humidity"),
                "wind_speed_mps": data.get("wind", {}).get("speed"),
                "heatwave_severity": (
                    "high"
                    if (data.get("main", {}).get("temp") or 0) >= 38
                    else "medium"
                    if (data.get("main", {}).get("temp") or 0) >= 34
                    else "low"
                ),
                "description": data.get("weather", [{}])[0].get("description"),
            }
        except Exception as exc:
            return {
                "source": "fallback",
                "ambient_temp_c": 31.0,
                "rain_mm_1h": 0.0,
                "humidity_pct": None,
                "wind_speed_mps": None,
                "heatwave_severity": "low",
                "description": f"weather_error:{exc}",
            }

    def elevation_delta(self, origin: dict[str, float], destination: dict[str, float] | None = None) -> dict[str, Any]:
        if not destination:
            return {"source": "fallback", "elevation_delta_m": 0.0, "grade_pct": 0.0}
        if not self.settings.google_maps_api_key:
            return {"source": "fallback", "elevation_delta_m": 0.0, "grade_pct": 0.0}

        locations = f"{origin['lat']},{origin['lng']}|{destination['lat']},{destination['lng']}"
        params = {"locations": locations, "key": self.settings.google_maps_api_key}
        try:
            with httpx.Client(timeout=self.settings.external_api_timeout_seconds) as client:
                resp = client.get("https://maps.googleapis.com/maps/api/elevation/json", params=params)
                resp.raise_for_status()
                data = resp.json()
            results = data.get("results", [])
            if len(results) < 2:
                return {"source": "google_elevation", "elevation_delta_m": 0.0, "grade_pct": 0.0}
            delta = float(results[1]["elevation"]) - float(results[0]["elevation"])
            distance_km = haversine_km(origin["lat"], origin["lng"], destination["lat"], destination["lng"])
            grade = (delta / max(distance_km * 1000.0, 1.0)) * 100.0
            return {"source": "google_elevation", "elevation_delta_m": round(delta, 2), "grade_pct": round(grade, 3)}
        except Exception as exc:
            return {"source": "fallback", "elevation_delta_m": 0.0, "grade_pct": 0.0, "error": str(exc)}

    def directions(self, origin: dict[str, float], destination: dict[str, float]) -> dict[str, Any]:
        if not self.settings.google_maps_api_key:
            distance_km = haversine_km(origin["lat"], origin["lng"], destination["lat"], destination["lng"])
            duration_min = fallback_travel_minutes(distance_km)
            return {
                "source": "fallback",
                "distance_km": round(distance_km, 2),
                "duration_min": round(duration_min, 1),
                "duration_traffic_min": round(duration_min * 1.18, 1),
                "traffic_index": 0.85,
                "eta_delay_min": round(duration_min * 0.18, 1),
                "incident_closure": False,
                "stop_start_probability": 0.62,
            }

        params = {
            "origin": f"{origin['lat']},{origin['lng']}",
            "destination": f"{destination['lat']},{destination['lng']}",
            "departure_time": "now",
            "traffic_model": "best_guess",
            "mode": "driving",
            "key": self.settings.google_maps_api_key,
        }
        try:
            with httpx.Client(timeout=self.settings.external_api_timeout_seconds) as client:
                resp = client.get("https://maps.googleapis.com/maps/api/directions/json", params=params)
                resp.raise_for_status()
                data = resp.json()
            leg = data["routes"][0]["legs"][0]
            duration_s = leg["duration"]["value"]
            traffic_s = leg.get("duration_in_traffic", {}).get("value", duration_s)
            traffic_index = min(1.0, duration_s / max(traffic_s, 1))
            return {
                "source": "google_directions",
                "distance_km": round(leg["distance"]["value"] / 1000.0, 2),
                "duration_min": round(duration_s / 60.0, 1),
                "duration_traffic_min": round(traffic_s / 60.0, 1),
                "traffic_index": round(traffic_index, 3),
                "eta_delay_min": round(max(traffic_s - duration_s, 0) / 60.0, 1),
                "incident_closure": False,
                "stop_start_probability": round(1.0 - traffic_index, 3),
            }
        except Exception as exc:
            distance_km = haversine_km(origin["lat"], origin["lng"], destination["lat"], destination["lng"])
            return {
                "source": "fallback",
                "distance_km": round(distance_km, 2),
                "duration_min": round(fallback_travel_minutes(distance_km), 1),
                "duration_traffic_min": round(fallback_travel_minutes(distance_km) * 1.18, 1),
                "traffic_index": 0.85,
                "eta_delay_min": round(fallback_travel_minutes(distance_km) * 0.18, 1),
                "incident_closure": False,
                "stop_start_probability": 0.62,
                "error": str(exc),
            }

    def nearest_chargers(self, lat: float, lng: float, radius_m: int = 500) -> list[dict[str, Any]]:
        api_key = self.settings.google_places_api_key or self.settings.google_maps_api_key
        if not api_key:
            return self._fallback_chargers(lat, lng, radius_m)

        params = {
            "location": f"{lat},{lng}",
            "radius": radius_m,
            "keyword": "EV charging station",
            "key": api_key,
        }
        try:
            with httpx.Client(timeout=self.settings.external_api_timeout_seconds) as client:
                resp = client.get("https://maps.googleapis.com/maps/api/place/nearbysearch/json", params=params)
                resp.raise_for_status()
                data = resp.json()
            chargers = []
            for result in data.get("results", [])[:10]:
                loc = result.get("geometry", {}).get("location", {})
                if "lat" not in loc or "lng" not in loc:
                    continue
                chargers.append(
                    {
                        "name": result.get("name"),
                        "lat": loc["lat"],
                        "lng": loc["lng"],
                        "distance_m": int(haversine_km(lat, lng, loc["lat"], loc["lng"]) * 1000),
                        "source": "google_places",
                    }
                )
            return sorted(chargers, key=lambda item: item["distance_m"])
        except Exception:
            return self._fallback_chargers(lat, lng, radius_m)

    def _fallback_chargers(self, lat: float, lng: float, radius_m: int = 500) -> list[dict[str, Any]]:
        chargers = []
        for charger in CHARGERS:
            distance_m = int(haversine_km(lat, lng, float(charger["lat"]), float(charger["lng"])) * 1000)
            if distance_m <= max(radius_m, 500):
                chargers.append({**charger, "distance_m": distance_m, "source": "fallback"})
        return sorted(chargers, key=lambda item: item["distance_m"])

    def route_context(self, origin: dict[str, float], destination: dict[str, float] | None = None) -> dict[str, Any]:
        context = {
            "generated_at_unix": int(time.time()),
            "weather": self.weather(origin["lat"], origin["lng"]),
            "elevation": self.elevation_delta(origin, destination),
        }
        if destination:
            context["traffic"] = self.directions(origin, destination)
        return context


external_context = ExternalContextService()
