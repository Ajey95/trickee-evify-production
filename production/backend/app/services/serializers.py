from datetime import datetime
from typing import Any

from app.services.physics import compute_range_factors


def iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def user_dict(user) -> dict[str, Any]:
    return {
        "id": user.id,
        "email": user.email,
        "firebase_uid": user.firebase_uid,
        "auth_provider": user.auth_provider,
        "full_name": user.full_name,
        "role": user.role,
        "fleet_id": user.fleet_id,
        "driver_id": user.driver_id,
        "is_active": user.is_active,
    }


def device_push_token_dict(row) -> dict[str, Any]:
    return {
        "id": row.id,
        "user_id": row.user_id,
        "platform": row.platform,
        "device_label": row.device_label,
        "is_active": row.is_active,
        "created_at": iso(row.created_at),
        "updated_at": iso(row.updated_at),
    }


def vehicle_dict(vehicle, latest=None, latest_driver=None) -> dict[str, Any]:
    data = {
        "id": vehicle.id,
        "fleet_id": vehicle.fleet_id,
        "vehicle_code": vehicle.vehicle_code,
        "make": vehicle.make,
        "model": vehicle.model,
        "battery_capacity_kwh": vehicle.battery_capacity_kwh,
        "max_range_km": vehicle.max_range_km,
        "battery_chemistry": vehicle.battery_chemistry,
        "manufacture_year": vehicle.manufacture_year,
        "is_active": vehicle.is_active,
    }
    if latest:
        data["latest"] = telemetry_dict(latest)
        data["latest_dynamic_range_km"] = compute_range_factors(
            soc=latest.soc,
            soh=latest.soh,
            temp_max=latest.temp_max,
            power_density=latest.power_density,
            max_range_km=vehicle.max_range_km,
        )["dynamic_range_km"]
    if latest_driver:
        data["latest_driver"] = driver_dict(latest_driver)
    return data


def driver_dict(driver) -> dict[str, Any]:
    return {
        "id": driver.id,
        "fleet_id": driver.fleet_id,
        "driver_code": driver.driver_code,
        "full_name": driver.full_name,
        "phone": driver.phone,
        "style_label": driver.style_label,
        "personal_factor": driver.personal_factor,
        "avg_regen_ratio": driver.avg_regen_ratio,
        "avg_throttle_variance": driver.avg_throttle_variance,
        "avg_current_30m": driver.avg_current_30m,
        "avg_speed_30m": driver.avg_speed_30m,
    }


def telemetry_dict(row) -> dict[str, Any]:
    return {
        "id": row.id,
        "vehicle_id": row.vehicle_id,
        "driver_id": row.driver_id,
        "recorded_at": iso(row.recorded_at),
        "soc": row.soc,
        "current": row.current,
        "battery_voltage": row.battery_voltage,
        "speed": row.speed,
        "temp_max": row.temp_max,
        "soh": row.soh,
        "charge_plug": row.charge_plug,
        "ignition_on": row.ignition_on,
        "regen_status": row.regen_status,
        "throttle_status": row.throttle_status,
        "cycle_count": row.cycle_count,
        "cell_imbalance_mv": row.cell_imbalance_mv,
        "wh_throughput": row.wh_throughput,
        "lat": row.lat,
        "lng": row.lng,
        "power": row.power,
        "power_density": row.power_density,
        "temp_rise_rate": row.temp_rise_rate,
        "voltage_sag_v": row.voltage_sag_v,
        "r_internal_mohm": row.r_internal_mohm,
        "minute_of_day": row.minute_of_day,
        "day_of_week": row.day_of_week,
    }


def prediction_dict(row) -> dict[str, Any]:
    return {
        "id": row.id,
        "vehicle_id": row.vehicle_id,
        "driver_id": row.driver_id,
        "predicted_at": iso(row.predicted_at),
        "actual_soc": row.actual_soc,
        "predicted_delta_soc": row.predicted_delta_soc,
        "predicted_next_soc": row.predicted_next_soc,
        "true_next_soc": row.true_next_soc,
        "ai_error": row.ai_error,
        "dynamic_range_km": row.dynamic_range_km,
        "predicted_range_km": row.predicted_range_km,
        "soh_factor": row.soh_factor,
        "thermal_factor": row.thermal_factor,
        "aggression_factor": row.aggression_factor,
        "window_size": row.window_size,
    }


def alert_dict(row) -> dict[str, Any]:
    return {
        "id": row.id,
        "vehicle_id": row.vehicle_id,
        "driver_id": row.driver_id,
        "alert_type": row.alert_type,
        "message": row.message,
        "soc_at_alert": row.soc_at_alert,
        "nearest_charger": row.nearest_charger,
        "charger_distance_m": row.charger_distance_m,
        "is_resolved": row.is_resolved,
        "created_at": iso(row.created_at),
    }


def trip_dict(row) -> dict[str, Any]:
    return {
        "id": row.id,
        "vehicle_id": row.vehicle_id,
        "driver_id": row.driver_id,
        "started_at": iso(row.started_at),
        "ended_at": iso(row.ended_at),
        "origin_lat": row.origin_lat,
        "origin_lng": row.origin_lng,
        "dest_lat": row.dest_lat,
        "dest_lng": row.dest_lng,
        "origin_label": row.origin_label,
        "dest_label": row.dest_label,
        "soc_start": row.soc_start,
        "soc_end": row.soc_end,
        "kwh_used": row.kwh_used,
        "distance_km": row.distance_km,
        "route_taken": row.route_taken,
        "recommended_route": row.recommended_route,
        "followed_nudge": row.followed_nudge,
    }


def driver_behavior_snapshot_dict(row) -> dict[str, Any]:
    return {
        "id": row.id,
        "driver_id": row.driver_id,
        "computed_at": iso(row.computed_at),
        "window_minutes": row.window_minutes,
        "sample_count": row.sample_count,
        "avg_current_30m": row.avg_current_30m,
        "avg_speed_30m": row.avg_speed_30m,
        "regen_ratio_30m": row.regen_ratio_30m,
        "throttle_var_30m": row.throttle_var_30m,
        "style_label": row.style_label,
    }


def nudge_event_dict(row) -> dict[str, Any]:
    return {
        "id": row.id,
        "driver_id": row.driver_id,
        "vehicle_id": row.vehicle_id,
        "alert_id": row.alert_id,
        "nudge_type": row.nudge_type,
        "channel": row.channel,
        "message": row.message,
        "payload": row.payload,
        "status": row.status,
        "outcome": row.outcome,
        "created_at": iso(row.created_at),
        "acknowledged_at": iso(row.acknowledged_at),
    }


def order_assignment_decision_dict(row) -> dict[str, Any]:
    return {
        "id": row.id,
        "fleet_id": row.fleet_id,
        "order_id": row.order_id,
        "assigned_driver_id": row.assigned_driver_id,
        "strategy": row.strategy,
        "restaurant_wait_min": row.restaurant_wait_min,
        "delivery_distance_km": row.delivery_distance_km,
        "required_range_km": row.required_range_km,
        "assignment_score": row.assignment_score,
        "request_payload": row.request_payload,
        "result_payload": row.result_payload,
        "outcome": row.outcome,
        "created_at": iso(row.created_at),
    }


def charging_decision_record_dict(row) -> dict[str, Any]:
    return {
        "id": row.id,
        "driver_id": row.driver_id,
        "vehicle_id": row.vehicle_id,
        "order_id": row.order_id,
        "chosen_option": row.chosen_option,
        "message": row.message,
        "selected_charger": row.selected_charger,
        "wait_window": row.wait_window,
        "request_payload": row.request_payload,
        "result_payload": row.result_payload,
        "outcome": row.outcome,
        "created_at": iso(row.created_at),
    }


def wait_event_dict(row) -> dict[str, Any]:
    return {
        "id": row.id,
        "vehicle_id": row.vehicle_id,
        "driver_id": row.driver_id,
        "started_at": iso(row.started_at),
        "ended_at": iso(row.ended_at),
        "last_seen_at": iso(row.last_seen_at),
        "wait_type": row.wait_type,
        "source": row.source,
        "ignition_on": row.ignition_on,
        "charge_plug": row.charge_plug,
        "lat": row.lat,
        "lng": row.lng,
        "duration_seconds": row.duration_seconds,
        "duration_min": round(row.duration_seconds / 60.0, 1),
        "confidence": row.confidence,
        "restaurant_distance_m": row.restaurant_distance_m,
        "charger_distance_m": row.charger_distance_m,
        "context": row.context,
        "created_at": iso(row.created_at),
    }
