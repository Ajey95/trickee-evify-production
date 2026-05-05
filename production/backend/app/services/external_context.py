from __future__ import annotations

import time
from typing import Any

import httpx

from app.config import get_settings
from app.services.alert_service import CHARGERS
from app.services.geo import fallback_travel_minutes, haversine_km

# Resolution for cache key bucketing: ~111 m per 0.001 degree.
_CACHE_LAT_LNG_PRECISION = 3
# Charger locations are essentially static; 20-minute TTL is more than sufficient.
_CHARGER_CACHE_TTL_SECONDS = 1200

# Weather varies at city scale (~11 km); 1 decimal place ≈ 11 km grid.  10-minute TTL.
_WEATHER_CACHE_PRECISION = 1
_WEATHER_CACHE_TTL_SECONDS = 600

# Traffic directions change on a ~5-minute cadence; same grid as chargers (~111 m).
_DIRECTIONS_CACHE_PRECISION = 3
_DIRECTIONS_CACHE_TTL_SECONDS = 300

# Terrain elevation is static; cache for 24 hours.
_ELEVATION_CACHE_PRECISION = 3
_ELEVATION_CACHE_TTL_SECONDS = 86400


class ExternalContextService:
    def __init__(self) -> None:
        self.settings = get_settings()
        # {(lat_key, lng_key, radius_m): (timestamp, result)}
        self._charger_cache: dict[tuple[float, float, int], tuple[float, list[dict[str, Any]]]] = {}
        # {(lat_key, lng_key): (timestamp, result)}
        self._weather_cache: dict[tuple[float, float], tuple[float, dict[str, Any]]] = {}
        # {(o_lat, o_lng, d_lat, d_lng): (timestamp, result)}
        self._directions_cache: dict[tuple[float, float, float, float], tuple[float, dict[str, Any]]] = {}
        # {(o_lat, o_lng, d_lat, d_lng): (timestamp, result)}
        self._elevation_cache: dict[tuple[float, float, float, float], tuple[float, dict[str, Any]]] = {}

    def weather(self, lat: float, lng: float) -> dict[str, Any]:
        cache_key = (round(lat, _WEATHER_CACHE_PRECISION), round(lng, _WEATHER_CACHE_PRECISION))
        cached_at, cached_result = self._weather_cache.get(cache_key, (0.0, None))
        if cached_result is not None and time.monotonic() - cached_at < _WEATHER_CACHE_TTL_SECONDS:
            return cached_result

        result = self._fetch_weather(lat, lng)
        self._weather_cache[cache_key] = (time.monotonic(), result)
        return result

    def _fetch_weather(self, lat: float, lng: float) -> dict[str, Any]:
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

        cache_key = (
            round(origin["lat"], _ELEVATION_CACHE_PRECISION),
            round(origin["lng"], _ELEVATION_CACHE_PRECISION),
            round(destination["lat"], _ELEVATION_CACHE_PRECISION),
            round(destination["lng"], _ELEVATION_CACHE_PRECISION),
        )
        cached_at, cached_result = self._elevation_cache.get(cache_key, (0.0, None))
        if cached_result is not None and time.monotonic() - cached_at < _ELEVATION_CACHE_TTL_SECONDS:
            return cached_result

        result = self._fetch_elevation(origin, destination)
        self._elevation_cache[cache_key] = (time.monotonic(), result)
        return result

    def _fetch_elevation(self, origin: dict[str, float], destination: dict[str, float]) -> dict[str, Any]:
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
        cache_key = (
            round(origin["lat"], _DIRECTIONS_CACHE_PRECISION),
            round(origin["lng"], _DIRECTIONS_CACHE_PRECISION),
            round(destination["lat"], _DIRECTIONS_CACHE_PRECISION),
            round(destination["lng"], _DIRECTIONS_CACHE_PRECISION),
        )
        cached_at, cached_result = self._directions_cache.get(cache_key, (0.0, None))
        if cached_result is not None and time.monotonic() - cached_at < _DIRECTIONS_CACHE_TTL_SECONDS:
            return cached_result

        result = self._fetch_directions(origin, destination)
        self._directions_cache[cache_key] = (time.monotonic(), result)
        return result

    def _fetch_directions(self, origin: dict[str, float], destination: dict[str, float]) -> dict[str, Any]:
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
        # Cache key buckets coordinates to _CACHE_LAT_LNG_PRECISION decimal places (~111 m grid).
        # radius_m is included so callers using different radii get independent cache entries;
        # in practice the codebase uses 300 m, 500 m, 750 m, and 1200 m.
        cache_key = (
            round(lat, _CACHE_LAT_LNG_PRECISION),
            round(lng, _CACHE_LAT_LNG_PRECISION),
            radius_m,
        )
        cached_at, cached_result = self._charger_cache.get(cache_key, (0.0, []))
        if time.monotonic() - cached_at < _CHARGER_CACHE_TTL_SECONDS:
            return cached_result

        result = self._fetch_chargers(lat, lng, radius_m)
        self._charger_cache[cache_key] = (time.monotonic(), result)
        return result

    def _fetch_chargers(self, lat: float, lng: float, radius_m: int) -> list[dict[str, Any]]:
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
