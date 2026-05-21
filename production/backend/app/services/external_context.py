from __future__ import annotations

import hashlib
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import get_settings
from app.services.alert_service import CHARGERS
from app.services.geo import fallback_travel_minutes, haversine_km

try:
    import h3
except Exception:  # pragma: no cover - optional dependency fallback during partial deploys.
    h3 = None

# Fallback rounded-grid precision when H3 is unavailable or disabled.
_CACHE_LAT_LNG_PRECISION = 3
# Charger locations are essentially static; 20-minute TTL is more than sufficient.
_CHARGER_CACHE_TTL_SECONDS = 1200

# Weather varies at city scale; H3 resolution 6 is neighborhood-sized. 10-minute TTL.
_WEATHER_CACHE_PRECISION = 1
_WEATHER_CACHE_TTL_SECONDS = 600

# Traffic directions change on a ~5-minute cadence.
_DIRECTIONS_CACHE_PRECISION = 3
_DIRECTIONS_CACHE_TTL_SECONDS = 300

# Terrain elevation is static; cache for 24 hours.
_ELEVATION_CACHE_PRECISION = 3
_ELEVATION_CACHE_TTL_SECONDS = 86400

_REDIS_KEY_PREFIX = "trickee:external-context"
logger = logging.getLogger(__name__)


class ExternalContextService:
    def __init__(self) -> None:
        self.settings = get_settings()
        # Cache keys use H3 cells when available, falling back to rounded lat/lng grids.
        self._charger_cache: dict[tuple[Any, ...], tuple[float, list[dict[str, Any]]]] = {}
        self._weather_cache: dict[tuple[Any, ...], tuple[float, dict[str, Any]]] = {}
        self._directions_cache: dict[tuple[Any, ...], tuple[float, dict[str, Any]]] = {}
        self._elevation_cache: dict[tuple[Any, ...], tuple[float, dict[str, Any]]] = {}
        self._quota_counters: dict[tuple[str, str], int] = {}
        self._quota_day: str | None = None

    def _h3_cell(self, lat: float, lng: float, resolution: int) -> str | None:
        if not (getattr(self.settings, "external_context_h3_enabled", True) and h3):
            return None
        try:
            if hasattr(h3, "latlng_to_cell"):
                return h3.latlng_to_cell(lat, lng, resolution)
            return h3.geo_to_h3(lat, lng, resolution)
        except Exception as exc:
            logger.warning("H3 cache bucketing failed; falling back to rounded grid: %s", exc)
            return None

    def _location_bucket(self, lat: float, lng: float, *, precision: int, resolution: int) -> tuple[Any, ...]:
        cell = self._h3_cell(lat, lng, resolution)
        if cell:
            return ("h3", resolution, cell)
        return ("grid", precision, round(lat, precision), round(lng, precision))

    def _route_bucket(
        self,
        origin: dict[str, float],
        destination: dict[str, float],
        *,
        precision: int,
        resolution: int,
    ) -> tuple[Any, ...]:
        return (
            *self._location_bucket(origin["lat"], origin["lng"], precision=precision, resolution=resolution),
            *self._location_bucket(destination["lat"], destination["lng"], precision=precision, resolution=resolution),
        )

    def _redis_client(self):
        if not (self.settings.external_context_redis_cache_enabled and self.settings.redis_url):
            return None
        try:
            from redis import Redis

            return Redis.from_url(self.settings.redis_url, decode_responses=True)
        except Exception as exc:
            logger.warning("External context Redis cache unavailable: %s", exc)
            return None

    def _cache_name(self, namespace: str, parts: tuple[Any, ...]) -> str:
        raw = json.dumps([namespace, *parts], sort_keys=True, separators=(",", ":"))
        digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        return f"{_REDIS_KEY_PREFIX}:cache:{namespace}:{digest}"

    def _read_persistent_cache(self, key: str, *, allow_stale: bool = False) -> Any | None:
        client = self._redis_client()
        if not client:
            return None
        try:
            raw = client.get(key)
            if not raw:
                return None
            payload = json.loads(raw)
            now = time.time()
            if now <= float(payload.get("expires_at", 0)):
                return payload.get("value")
            if allow_stale and now <= float(payload.get("stale_until", 0)):
                value = payload.get("value")
                if isinstance(value, dict):
                    return {**value, "cache_status": "stale"}
                return value
        except Exception as exc:
            logger.warning("External context cache read failed: %s", exc)
        finally:
            try:
                client.close()
            except Exception:
                pass
        return None

    def _write_persistent_cache(self, key: str, value: Any, ttl_seconds: int) -> None:
        client = self._redis_client()
        if not client:
            return
        stale_ttl = max(ttl_seconds, self.settings.external_context_stale_cache_seconds)
        now = time.time()
        payload = {
            "expires_at": now + ttl_seconds,
            "stale_until": now + stale_ttl,
            "value": value,
        }
        try:
            client.setex(key, stale_ttl, json.dumps(payload, default=str))
        except Exception as exc:
            logger.warning("External context cache write failed: %s", exc)
        finally:
            try:
                client.close()
            except Exception:
                pass

    def _quota_key(self, provider: str) -> tuple[str, str]:
        day = datetime.now(timezone.utc).strftime("%Y%m%d")
        return (provider, day)

    def _daily_limit_for(self, provider: str) -> int:
        if provider == "google":
            return self.settings.google_external_daily_limit
        if provider == "openweather":
            return self.settings.openweather_external_daily_limit
        return 0

    def _consume_provider_quota(self, provider: str) -> bool:
        limit = self._daily_limit_for(provider)
        if limit <= 0:
            return False

        quota_key = self._quota_key(provider)
        redis_key = f"{_REDIS_KEY_PREFIX}:quota:{provider}:{quota_key[1]}"
        client = self._redis_client()
        if client:
            try:
                count = int(client.incr(redis_key))
                client.expire(redis_key, 60 * 60 * 48)
                if count > limit:
                    logger.warning("External provider quota exhausted provider=%s count=%s limit=%s", provider, count, limit)
                    return False
                return True
            except Exception as exc:
                logger.warning("External provider quota Redis check failed: %s", exc)
            finally:
                try:
                    client.close()
                except Exception:
                    pass

        if self._quota_day != quota_key[1]:
            self._quota_counters.clear()
            self._quota_day = quota_key[1]
        count = self._quota_counters.get(quota_key, 0) + 1
        self._quota_counters[quota_key] = count
        if count > limit:
            logger.warning("External provider local quota exhausted provider=%s count=%s limit=%s", provider, count, limit)
            return False
        return True

    def _quota_blocked(self, provider: str, service: str) -> dict[str, Any]:
        return {
            "source": "fallback",
            "quota_status": "blocked",
            "service": service,
            "description": f"{provider} daily quota guard blocked external call",
        }

    def weather(self, lat: float, lng: float) -> dict[str, Any]:
        cache_key = self._location_bucket(
            lat,
            lng,
            precision=_WEATHER_CACHE_PRECISION,
            resolution=getattr(self.settings, "external_context_weather_h3_resolution", 6),
        )
        cached_at, cached_result = self._weather_cache.get(cache_key, (0.0, None))
        if cached_result is not None and time.monotonic() - cached_at < _WEATHER_CACHE_TTL_SECONDS:
            return cached_result
        persistent_key = self._cache_name("weather", cache_key)
        persistent = self._read_persistent_cache(persistent_key)
        if persistent is not None:
            self._weather_cache[cache_key] = (time.monotonic(), persistent)
            return persistent

        result = self._fetch_weather(lat, lng)
        self._weather_cache[cache_key] = (time.monotonic(), result)
        self._write_persistent_cache(persistent_key, result, _WEATHER_CACHE_TTL_SECONDS)
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
        if not self._consume_provider_quota("openweather"):
            return {
                "ambient_temp_c": 31.0,
                "rain_mm_1h": 0.0,
                "humidity_pct": None,
                "wind_speed_mps": None,
                "heatwave_severity": "low",
                **self._quota_blocked("openweather", "weather"),
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

        cache_key = self._route_bucket(
            origin,
            destination,
            precision=_ELEVATION_CACHE_PRECISION,
            resolution=getattr(self.settings, "external_context_h3_resolution", 10),
        )
        cached_at, cached_result = self._elevation_cache.get(cache_key, (0.0, None))
        if cached_result is not None and time.monotonic() - cached_at < _ELEVATION_CACHE_TTL_SECONDS:
            return cached_result
        persistent_key = self._cache_name("elevation", cache_key)
        persistent = self._read_persistent_cache(persistent_key)
        if persistent is not None:
            self._elevation_cache[cache_key] = (time.monotonic(), persistent)
            return persistent

        if self.settings.google_maps_api_key and not self._consume_provider_quota("google"):
            stale = self._read_persistent_cache(persistent_key, allow_stale=True)
            if stale is not None:
                self._elevation_cache[cache_key] = (time.monotonic(), stale)
                return stale
            return {"elevation_delta_m": 0.0, "grade_pct": 0.0, **self._quota_blocked("google", "elevation")}

        result = self._fetch_elevation(origin, destination)
        self._elevation_cache[cache_key] = (time.monotonic(), result)
        self._write_persistent_cache(persistent_key, result, _ELEVATION_CACHE_TTL_SECONDS)
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
        cache_key = self._route_bucket(
            origin,
            destination,
            precision=_DIRECTIONS_CACHE_PRECISION,
            resolution=getattr(self.settings, "external_context_h3_resolution", 10),
        )
        cached_at, cached_result = self._directions_cache.get(cache_key, (0.0, None))
        if cached_result is not None and time.monotonic() - cached_at < _DIRECTIONS_CACHE_TTL_SECONDS:
            return cached_result
        persistent_key = self._cache_name("directions", cache_key)
        persistent = self._read_persistent_cache(persistent_key)
        if persistent is not None:
            self._directions_cache[cache_key] = (time.monotonic(), persistent)
            return persistent

        if self.settings.google_maps_api_key and not self._consume_provider_quota("google"):
            stale = self._read_persistent_cache(persistent_key, allow_stale=True)
            if stale is not None:
                self._directions_cache[cache_key] = (time.monotonic(), stale)
                return stale
            distance_km = haversine_km(origin["lat"], origin["lng"], destination["lat"], destination["lng"])
            duration_min = fallback_travel_minutes(distance_km)
            return {
                "distance_km": round(distance_km, 2),
                "duration_min": round(duration_min, 1),
                "duration_traffic_min": round(duration_min * 1.18, 1),
                "traffic_index": 0.85,
                "eta_delay_min": round(duration_min * 0.18, 1),
                "incident_closure": False,
                "stop_start_probability": 0.62,
                **self._quota_blocked("google", "directions"),
            }

        result = self._fetch_directions(origin, destination)
        self._directions_cache[cache_key] = (time.monotonic(), result)
        self._write_persistent_cache(persistent_key, result, _DIRECTIONS_CACHE_TTL_SECONDS)
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
        # Cache key buckets coordinates to an H3 cell, with rounded-grid fallback.
        # radius_m is included so callers using different radii get independent cache entries;
        # in practice the codebase uses 300 m, 500 m, 750 m, and 1200 m.
        cache_key = (
            *self._location_bucket(
                lat,
                lng,
                precision=_CACHE_LAT_LNG_PRECISION,
                resolution=getattr(self.settings, "external_context_h3_resolution", 10),
            ),
            radius_m,
        )
        cached_at, cached_result = self._charger_cache.get(cache_key, (0.0, []))
        if time.monotonic() - cached_at < _CHARGER_CACHE_TTL_SECONDS:
            return cached_result
        persistent_key = self._cache_name("chargers", cache_key)
        persistent = self._read_persistent_cache(persistent_key)
        if persistent is not None:
            self._charger_cache[cache_key] = (time.monotonic(), persistent)
            return persistent

        api_key = self.settings.google_places_api_key or self.settings.google_maps_api_key
        if api_key and not self._consume_provider_quota("google"):
            stale = self._read_persistent_cache(persistent_key, allow_stale=True)
            if stale is not None:
                self._charger_cache[cache_key] = (time.monotonic(), stale)
                return stale
            fallback = [
                {**charger, "quota_status": "blocked"}
                for charger in self._fallback_chargers(lat, lng, radius_m)
            ]
            self._charger_cache[cache_key] = (time.monotonic(), fallback)
            return fallback

        result = self._fetch_chargers(lat, lng, radius_m)
        self._charger_cache[cache_key] = (time.monotonic(), result)
        self._write_persistent_cache(persistent_key, result, _CHARGER_CACHE_TTL_SECONDS)
        return result

    def _fetch_chargers(self, lat: float, lng: float, radius_m: int) -> list[dict[str, Any]]:
        api_key = self.settings.google_places_api_key or self.settings.google_maps_api_key
        if not api_key:
            return self._fallback_chargers(lat, lng, radius_m)

        try:
            chargers = self._fetch_chargers_places_new(lat, lng, radius_m, api_key)
            if chargers:
                return chargers
            return self._fetch_chargers_legacy(lat, lng, radius_m, api_key)
        except Exception as exc:
            logger.warning("Google charger lookup failed; using fallback chargers: %s", exc)
            return self._fallback_chargers(lat, lng, radius_m)

    def _fetch_chargers_places_new(self, lat: float, lng: float, radius_m: int, api_key: str) -> list[dict[str, Any]]:
        payload = {
            "includedTypes": ["electric_vehicle_charging_station"],
            "maxResultCount": 10,
            "rankPreference": "DISTANCE",
            "locationRestriction": {
                "circle": {
                    "center": {"latitude": lat, "longitude": lng},
                    "radius": float(max(100, min(radius_m, 50_000))),
                }
            },
        }
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": "places.displayName,places.location,places.rating,places.primaryType,places.types,places.googleMapsUri",
        }
        with httpx.Client(timeout=self.settings.external_api_timeout_seconds) as client:
            resp = client.post("https://places.googleapis.com/v1/places:searchNearby", json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        chargers = []
        for place in data.get("places", [])[:10]:
            loc = place.get("location", {})
            place_lat = loc.get("latitude")
            place_lng = loc.get("longitude")
            if place_lat is None or place_lng is None:
                continue
            display = place.get("displayName") or {}
            chargers.append(
                {
                    "name": display.get("text") or "EV charging station",
                    "lat": place_lat,
                    "lng": place_lng,
                    "distance_m": int(haversine_km(lat, lng, float(place_lat), float(place_lng)) * 1000),
                    "rating": place.get("rating"),
                    "google_maps_uri": place.get("googleMapsUri"),
                    "source": "google_places_new",
                }
            )
        return sorted(chargers, key=lambda item: item["distance_m"])

    def _fetch_chargers_legacy(self, lat: float, lng: float, radius_m: int, api_key: str) -> list[dict[str, Any]]:
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
            if data.get("status") not in {None, "OK", "ZERO_RESULTS"}:
                logger.warning("Legacy Google Places charger lookup returned status=%s", data.get("status"))
                return []
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
                        "rating": result.get("rating"),
                        "source": "google_places",
                    }
                )
            return sorted(chargers, key=lambda item: item["distance_m"])
        except Exception as exc:
            logger.warning("Legacy Google Places charger lookup failed: %s", exc)
            return []

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
