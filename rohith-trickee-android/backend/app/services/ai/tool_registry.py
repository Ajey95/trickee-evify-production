from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import time
from typing import Any, Callable

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models import Driver, Prediction, Telemetry, ToolCallLog, Trip, User, Vehicle
from app.services.access import assert_driver_access, assert_vehicle_access
from app.services.ai.safety import safe_error, sanitize_payload
from app.services.external_context import external_context
from app.services.live_driver_profile import live_driver_profile
from app.services.live_intelligence import fleet_live_overview, live_driver_decision
from app.services.physics import compute_range_factors
from app.services.route_scorer import route_scores
from app.services.serializers import prediction_dict, telemetry_dict, trip_dict


@dataclass
class ToolResult:
    name: str
    success: bool
    data: dict[str, Any]
    fallback_used: bool = False
    error_message: str | None = None
    latency_ms: int | None = None


class AIToolRegistry:
    def __init__(self, db: Session, user: User, *, feature: str):
        self.db = db
        self.user = user
        self.feature = feature
        self._tools: dict[str, Callable[[dict[str, Any]], dict[str, Any]]] = {
            "get_driver_profile": self._get_driver_profile,
            "get_vehicle_state": self._get_vehicle_state,
            "get_battery_prediction": self._get_battery_prediction,
            "get_nearest_charger": self._get_nearest_charger,
            "get_route_score": self._get_route_score,
            "get_trip_history": self._get_trip_history,
            "get_fleet_status": self._get_fleet_status,
            "get_driver_baseline": self._get_driver_baseline,
            "get_environment_context": self._get_environment_context,
            "risk_analyzer": self._risk_analyzer,
        }

    @property
    def tool_specs(self) -> list[dict[str, Any]]:
        return [
            {"name": name, "requires_auth": True, "timeout_ms": 3000, "rate_limit_key": "driver_id | vehicle_id | fleet_id"}
            for name in sorted(self._tools)
        ]

    def call(self, name: str, payload: dict[str, Any]) -> ToolResult:
        started = time.monotonic()
        try:
            if name not in self._tools:
                raise ValueError("unknown_tool")
            data = self._tools[name](payload)
            result = ToolResult(name=name, success=True, data=data, latency_ms=int((time.monotonic() - started) * 1000))
        except Exception as exc:  # noqa: BLE001 - returned/stored as sanitized tool failure
            result = ToolResult(
                name=name,
                success=False,
                data={},
                fallback_used=True,
                error_message=safe_error(exc),
                latency_ms=int((time.monotonic() - started) * 1000),
            )
        self._log_call(result, payload)
        return result

    def _log_call(self, result: ToolResult, payload: dict[str, Any]) -> None:
        self.db.add(
            ToolCallLog(
                user_id=self.user.id,
                driver_id=payload.get("driver_id"),
                vehicle_id=payload.get("vehicle_id"),
                fleet_id=payload.get("fleet_id") or self.user.fleet_id,
                feature=self.feature,
                tool_name=result.name,
                input_summary=sanitize_payload(payload),
                output_summary=sanitize_payload(result.data),
                success=result.success,
                fallback_used=result.fallback_used,
                latency_ms=result.latency_ms,
                error_message=result.error_message,
            )
        )

    def _get_driver_profile(self, payload: dict[str, Any]) -> dict[str, Any]:
        driver = assert_driver_access(self.db, self.user, str(payload["driver_id"]))
        try:
            return live_driver_profile(self.db, driver)
        except Exception:
            return {
                "driver_id": driver.id,
                "driver_code": driver.driver_code,
                "style": driver.style_label,
                "personal_factor": driver.personal_factor,
                "avg_speed_kmh": driver.avg_speed_30m,
                "avg_current_a": driver.avg_current_30m,
                "confidence": 0.35,
            }

    def _get_vehicle_state(self, payload: dict[str, Any]) -> dict[str, Any]:
        vehicle = assert_vehicle_access(self.db, self.user, str(payload["vehicle_id"]))
        latest = (
            self.db.query(Telemetry)
            .filter(Telemetry.vehicle_id == vehicle.id)
            .order_by(desc(Telemetry.recorded_at))
            .first()
        )
        if not latest:
            return {"vehicle_id": vehicle.id, "vehicle_code": vehicle.vehicle_code, "state": "unavailable"}
        return {"vehicle_id": vehicle.id, "vehicle_code": vehicle.vehicle_code, "latest": telemetry_dict(latest)}

    def _get_battery_prediction(self, payload: dict[str, Any]) -> dict[str, Any]:
        vehicle = assert_vehicle_access(self.db, self.user, str(payload["vehicle_id"]))
        prediction = (
            self.db.query(Prediction)
            .filter(Prediction.vehicle_id == vehicle.id)
            .order_by(desc(Prediction.predicted_at))
            .first()
        )
        if prediction:
            return prediction_dict(prediction)
        latest = (
            self.db.query(Telemetry)
            .filter(Telemetry.vehicle_id == vehicle.id)
            .order_by(desc(Telemetry.recorded_at))
            .first()
        )
        if not latest:
            return {"vehicle_id": vehicle.id, "prediction_status": "unavailable"}
        factors = compute_range_factors(
            soc=latest.soc,
            soh=latest.soh,
            temp_max=latest.temp_max,
            power_density=latest.power_density,
            max_range_km=vehicle.max_range_km,
        )
        return {
            "vehicle_id": vehicle.id,
            "actual_soc": latest.soc,
            "predicted_next_soc": latest.soc,
            "predicted_range_km": factors["dynamic_range_km"],
            "prediction_status": "range_fallback",
            **factors,
        }

    def _get_nearest_charger(self, payload: dict[str, Any]) -> dict[str, Any]:
        lat = float(payload["lat"])
        lng = float(payload["lng"])
        radius_m = int(payload.get("radius_m") or 1500)
        chargers = external_context.nearest_chargers(lat, lng, radius_m=radius_m)
        return {"chargers": chargers[:5], "availability_confirmed": False}

    def _get_route_score(self, payload: dict[str, Any]) -> dict[str, Any]:
        driver_id = payload.get("driver_id")
        personal_factor = float(payload.get("personal_factor") or 1.1)
        if driver_id:
            driver = assert_driver_access(self.db, self.user, str(driver_id))
            personal_factor = driver.personal_factor or personal_factor
        return route_scores(
            str(payload.get("day_type") or "weekday"),
            str(payload.get("slot") or "morning"),
            personal_factor,
            float(payload.get("soc_start") or payload.get("current_soc") or 80.0),
            origin=payload.get("origin"),
            destination=payload.get("destination"),
        )

    def _get_trip_history(self, payload: dict[str, Any]) -> dict[str, Any]:
        driver = assert_driver_access(self.db, self.user, str(payload["driver_id"]))
        since = datetime.utcnow() - timedelta(days=int(payload.get("days") or 30))
        rows = (
            self.db.query(Trip)
            .filter(Trip.driver_id == driver.id, Trip.started_at >= since)
            .order_by(desc(Trip.started_at))
            .limit(20)
            .all()
        )
        return {"trips": [trip_dict(row) for row in rows], "sample_count": len(rows)}

    def _get_fleet_status(self, payload: dict[str, Any]) -> dict[str, Any]:
        return fleet_live_overview(self.db, self.user)

    def _get_driver_baseline(self, payload: dict[str, Any]) -> dict[str, Any]:
        driver = assert_driver_access(self.db, self.user, str(payload["driver_id"]))
        rows = (
            self.db.query(Telemetry)
            .filter(Telemetry.driver_id == driver.id)
            .order_by(desc(Telemetry.recorded_at))
            .limit(500)
            .all()
        )
        if not rows:
            return {"sample_count": 0, "confidence": 0.2}
        avg_current = sum(abs(float(row.current or 0.0)) for row in rows) / len(rows)
        avg_speed = sum(float(row.speed or 0.0) for row in rows) / len(rows)
        avg_temp = sum(float(row.temp_max or 0.0) for row in rows) / len(rows)
        low_soc_pct = sum(1 for row in rows if row.soc < 25) / len(rows) * 100
        return {
            "sample_count": len(rows),
            "avg_current_a": round(avg_current, 2),
            "avg_speed_kmh": round(avg_speed, 2),
            "avg_temp_c": round(avg_temp, 1),
            "low_soc_pct": round(low_soc_pct, 1),
            "confidence": min(0.9, 0.35 + len(rows) / 1000),
        }

    def _get_environment_context(self, payload: dict[str, Any]) -> dict[str, Any]:
        origin = payload["origin"]
        destination = payload.get("destination")
        return external_context.route_context(origin, destination)

    def _risk_analyzer(self, payload: dict[str, Any]) -> dict[str, Any]:
        vehicle_state = self._get_vehicle_state(payload)
        latest = vehicle_state.get("latest") or {}
        soc = float(latest.get("soc") or 0.0)
        temp = float(latest.get("temp_max") or 0.0)
        current = abs(float(latest.get("current") or 0.0))
        reasons: list[str] = []
        if soc < 15:
            reasons.append("critical_low_soc")
        elif soc < 25:
            reasons.append("low_soc")
        if temp >= 58:
            reasons.append("high_temperature")
        if current >= 18:
            reasons.append("high_current_draw")
        return {
            "risk_level": "critical" if soc < 15 else "high" if reasons else "low",
            "reasons": reasons,
            "vehicle_state": vehicle_state,
        }
