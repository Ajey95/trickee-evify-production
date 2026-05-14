from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models import Driver, NudgeEvent, Telemetry, User, Vehicle, WaitEvent
from app.services.access import assert_driver_access
from app.services.charge_plan import build_destination_charge_plan
from app.services.external_context import external_context
from app.services.live_driver_profile import LOW_SOC_THRESHOLD, live_driver_profile
from app.services.physics import compute_range_factors
from app.services.wait_classifier import classify_wait


def _valid_gps(row: Telemetry | None) -> bool:
    return bool(row and row.lat is not None and row.lng is not None and row.lat != 0 and row.lng != 0)


def _latest_driver_row(db: Session, driver: Driver) -> Telemetry | None:
    return db.query(Telemetry).filter(Telemetry.driver_id == driver.id).order_by(desc(Telemetry.recorded_at)).first()


def _latest_vehicle_row(db: Session, vehicle_id: str) -> Telemetry | None:
    return db.query(Telemetry).filter(Telemetry.vehicle_id == vehicle_id).order_by(desc(Telemetry.recorded_at)).first()


def _route_recommendation(
    latest: Telemetry | None,
    destination: dict[str, float] | None,
    profile: dict[str, Any],
    personal_factor: float,
) -> dict[str, Any]:
    if not latest or not _valid_gps(latest):
        return {
            "status": "waiting_for_location",
            "message": "Need live driver location before scoring a route.",
        }
    if not destination:
        return {
            "status": "waiting_for_destination",
            "message": "No destination attached yet; keep monitoring live SOC and stop windows.",
        }

    origin = {"lat": float(latest.lat), "lng": float(latest.lng)}
    context = external_context.route_context(origin, destination)
    traffic = context.get("traffic", {})
    distance_km = float(traffic.get("distance_km") or 0.0)
    traffic_duration_min = float(traffic.get("duration_traffic_min") or traffic.get("duration_min") or 0.0)
    personalized_eta_min = round(traffic_duration_min * max(personal_factor, 0.5), 1)
    risk_score = float(profile.get("battery", {}).get("battery_risk_score") or 0.0)
    archetype_policy = profile.get("archetype", {}).get("policy", {})
    archetype_buffer = float(archetype_policy.get("route_buffer_multiplier") or 1.0)
    risk_buffer_km = (1.35 if risk_score >= 65 else 1.25 if risk_score >= 40 else 1.15) * archetype_buffer
    required_range_km = round(distance_km * risk_buffer_km, 2)
    current_range_km = float(profile.get("personalized_range", {}).get("estimated_range_km") or 0.0)
    current_soc = float(latest.soc or 0.0)
    km_per_soc_pct = current_range_km / current_soc if current_soc > 0 and current_range_km > 0 else 0.0
    soc_required_pct = required_range_km / km_per_soc_pct if km_per_soc_pct > 0 else 100.0
    nearest_charger = profile.get("charging", {}).get("nearest_charger")
    charge_plan = build_destination_charge_plan(
        current_soc_pct=current_soc,
        soc_required_pct=soc_required_pct,
        charger=nearest_charger,
    )
    route_state = "safe" if current_range_km >= required_range_km else "charge_first"
    return {
        "status": route_state,
        "origin": origin,
        "destination": destination,
        "distance_km": distance_km,
        "traffic_duration_min": traffic_duration_min,
        "personalized_eta_min": personalized_eta_min,
        "personal_factor": personal_factor,
        "archetype": profile.get("archetype"),
        "traffic_index": traffic.get("traffic_index"),
        "required_range_km": required_range_km,
        "soc_required_pct": round(soc_required_pct, 1),
        "destination_charge_plan": charge_plan,
        "message": (
            "Route is acceptable for this driver profile."
            if route_state == "safe"
            else charge_plan["message"]
        ),
        "external_context": context,
    }


def _charging_recommendation(
    latest: Telemetry | None,
    profile: dict[str, Any],
    wait: dict[str, Any] | None,
    order_context: dict[str, Any] | None,
) -> dict[str, Any]:
    if not latest:
        return {"action": "await_telemetry", "message": "Awaiting live telemetry before charging advice."}

    nearest_charger = profile.get("charging", {}).get("nearest_charger")
    risk_level = profile.get("battery", {}).get("risk_level", "low")
    archetype = profile.get("archetype") or {}
    archetype_label = archetype.get("label")
    warning_adjust = float(archetype.get("policy", {}).get("soc_warning_adjust_pct") or 0.0)
    warning_threshold = float(profile.get("battery", {}).get("warning_soc_threshold") or 25) + warning_adjust
    wait_type = wait.get("wait_type") if wait else None
    is_chargeable_wait = wait_type in {"restaurant_wait", "idle_wait", "charging_wait"}
    restaurant_wait_min = float((order_context or {}).get("restaurant_wait_min") or 0.0)

    if latest.soc <= 15:
        return {
            "action": "charge_now",
            "urgency": "critical",
            "nearest_charger": nearest_charger,
            "message": "Charge now. SOC is below the critical live threshold.",
        }
    if latest.soc <= LOW_SOC_THRESHOLD and not nearest_charger:
        return {
            "action": "charge_now",
            "urgency": "high",
            "nearest_charger": None,
            "archetype": archetype,
            "message": "Charge before accepting a long delivery. SOC is below the live low-SOC threshold.",
        }
    if latest.soc <= warning_threshold and is_chargeable_wait and nearest_charger:
        return {
            "action": "charge_during_wait",
            "urgency": "high" if risk_level == "high" else "medium",
            "nearest_charger": nearest_charger,
            "archetype": archetype,
            "message": f"Use this {wait_type.replace('_', ' ')} to top up near {nearest_charger['name']}.",
        }
    if archetype_label == "stop_wait_optimizer" and is_chargeable_wait and nearest_charger and latest.soc < 45:
        return {
            "action": "opportunistic_top_up",
            "urgency": "medium",
            "nearest_charger": nearest_charger,
            "archetype": archetype,
            "message": f"Stop-window pattern detected. Top up near {nearest_charger['name']} while waiting.",
        }
    if latest.soc <= warning_threshold and nearest_charger:
        return {
            "action": "detour_to_charger",
            "urgency": "high" if risk_level == "high" else "medium",
            "nearest_charger": nearest_charger,
            "archetype": archetype,
            "message": f"Detour to {nearest_charger['name']} before a long delivery.",
        }
    if restaurant_wait_min >= 12 and nearest_charger and latest.soc < 45:
        return {
            "action": "opportunistic_top_up",
            "urgency": "low",
            "nearest_charger": nearest_charger,
            "archetype": archetype,
            "message": f"Optional top-up is useful if the pickup wait stays above {restaurant_wait_min:.0f} min.",
        }
    return {
        "action": "continue_delivery",
        "urgency": "low",
        "nearest_charger": nearest_charger,
        "archetype": archetype,
        "message": "Continue delivery. SOC and driver risk are inside live operating limits.",
    }


def _personalized_range(db: Session, latest: Telemetry | None, driver: Driver, profile: dict[str, Any]) -> dict[str, Any]:
    if not latest:
        return {"estimated_range_km": 0.0, "confidence": profile.get("range_confidence")}
    vehicle = db.get(Vehicle, latest.vehicle_id)
    max_range_km = vehicle.max_range_km if vehicle else 85.0
    factors = compute_range_factors(
        soc=latest.soc,
        soh=latest.soh,
        temp_max=latest.temp_max,
        power_density=latest.power_density,
        max_range_km=max_range_km,
    )
    driver_factor = max(float(driver.personal_factor or 1.0), 0.5)
    estimated_range = max(0.0, factors["dynamic_range_km"] / driver_factor)
    return {
        "estimated_range_km": round(estimated_range, 2),
        "base_dynamic_range_km": factors["dynamic_range_km"],
        "driver_personal_factor": driver_factor,
        "confidence": profile.get("range_confidence"),
    }


def live_driver_decision(
    db: Session,
    driver: Driver,
    *,
    destination: dict[str, float] | None = None,
    order_context: dict[str, Any] | None = None,
    persist_nudge: bool = False,
) -> dict[str, Any]:
    profile = live_driver_profile(db, driver)
    latest = _latest_driver_row(db, driver)
    personalized_range = _personalized_range(db, latest, driver, profile)
    profile["personalized_range"] = personalized_range

    wait = classify_wait(latest, order_context=order_context) if latest else None
    charging = _charging_recommendation(latest, profile, wait, order_context)
    route = _route_recommendation(latest, destination, profile, float(driver.personal_factor or 1.1))
    nudge_message = (
        route["message"]
        if route.get("status") == "charge_first"
        else charging["message"]
        if charging["action"] != "continue_delivery"
        else route["message"]
    )

    if persist_nudge and latest and driver.id:
        db.add(
            NudgeEvent(
                driver_id=driver.id,
                vehicle_id=latest.vehicle_id,
                nudge_type="live_personalization",
                channel="dashboard",
                message=nudge_message,
                payload={
                    "archetype": profile.get("archetype"),
                    "charging": charging,
                    "route": route,
                    "personalized_range": personalized_range,
                    "wait": wait,
                },
                status="created",
                created_at=datetime.utcnow(),
            )
        )
        db.commit()

    return {
        "driver_id": driver.id,
        "driver_code": driver.driver_code,
        "generated_at": datetime.utcnow().isoformat(),
        "profile": profile,
        "personalized_range": personalized_range,
        "wait_classification": wait,
        "charging_recommendation": charging,
        "route_recommendation": route,
        "driver_nudge": {
            "channel": "dashboard",
            "message": nudge_message,
            "severity": charging.get("urgency", "low"),
        },
    }


def fleet_live_overview(db: Session, user: User, window_minutes: int = 7 * 24 * 60) -> dict[str, Any]:
    query = db.query(Driver)
    if user.role == "fleet_operator":
        query = query.filter(Driver.fleet_id == user.fleet_id)
    drivers = query.order_by(Driver.driver_code).limit(100).all()

    rows = []
    for driver in drivers:
        driver = assert_driver_access(db, user, driver.id)
        profile = live_driver_profile(db, driver, window_minutes=window_minutes)
        latest_data = profile.get("latest") or {}
        rows.append(
            {
                "driver_id": driver.id,
                "driver_code": driver.driver_code,
                "driver_name": driver.full_name,
                "vehicle_id": latest_data.get("vehicle_id"),
                "latest_soc": latest_data.get("soc"),
                "latest_speed": latest_data.get("speed"),
                "latest_seen_at": latest_data.get("recorded_at"),
                "risk_level": profile.get("battery", {}).get("risk_level"),
                "battery_risk_score": profile.get("battery", {}).get("battery_risk_score"),
                "archetype": profile.get("archetype"),
                "stop_wait_pct": profile.get("behavior", {}).get("stop_wait_pct"),
                "regen_ratio_pct": profile.get("behavior", {}).get("regen_ratio_pct"),
                "profile_status": profile.get("profile_status"),
                "next_best_action": profile.get("next_best_action"),
                "active_wait": profile.get("waits", {}).get("active_wait"),
                "location": latest_data,
            }
        )

    active_drivers = [row for row in rows if row["latest_seen_at"]]
    battery_risk_drivers = [row for row in rows if (row.get("battery_risk_score") or 0) >= 40]
    stuck_drivers = [row for row in rows if row.get("active_wait") in {"traffic_wait", "idle_wait", "restaurant_wait"}]
    inefficient_drivers = [
        row
        for row in rows
        if (row.get("regen_ratio_pct") is not None and row["regen_ratio_pct"] < 20)
        or (row.get("stop_wait_pct") is not None and row["stop_wait_pct"] > 45)
    ]
    charging_opportunities = [
        row
        for row in rows
        if row.get("latest_soc") is not None
        and row["latest_soc"] < 35
        and row.get("active_wait") in {"restaurant_wait", "idle_wait", "charging_wait"}
    ]

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "window_minutes": window_minutes,
        "summary": {
            "total_drivers": len(rows),
            "active_drivers": len(active_drivers),
            "battery_risk_drivers": len(battery_risk_drivers),
            "inefficient_drivers": len(inefficient_drivers),
            "stuck_or_waiting_drivers": len(stuck_drivers),
            "charging_opportunities": len(charging_opportunities),
        },
        "drivers": rows,
        "risk_lists": {
            "battery_risk": sorted(battery_risk_drivers, key=lambda row: row.get("battery_risk_score") or 0, reverse=True),
            "inefficient": inefficient_drivers,
            "stuck_or_waiting": stuck_drivers,
            "charging_opportunities": charging_opportunities,
        },
    }


def live_map_context(db: Session, user: User, driver_id: str | None = None) -> dict[str, Any]:
    if driver_id:
        drivers = [assert_driver_access(db, user, driver_id)]
    else:
        query = db.query(Driver)
        if user.role == "driver":
            query = query.filter(Driver.id == user.driver_id)
        elif user.role == "fleet_operator":
            query = query.filter(Driver.fleet_id == user.fleet_id)
        drivers = query.order_by(Driver.driver_code).limit(100).all()

    vehicle_points = []
    low_soc_zones = []
    stop_zones = []
    charger_points: dict[str, dict[str, Any]] = {}
    for driver in drivers:
        profile = live_driver_profile(db, driver)
        latest_data = profile.get("latest") or {}
        lat = latest_data.get("lat")
        lng = latest_data.get("lng")
        if lat and lng and lat != 0 and lng != 0:
            vehicle_points.append(
                {
                    "driver_id": driver.id,
                    "driver_code": driver.driver_code,
                    "vehicle_id": latest_data.get("vehicle_id"),
                    "lat": lat,
                    "lng": lng,
                    "soc": latest_data.get("soc"),
                    "speed": latest_data.get("speed"),
                    "risk_level": profile.get("battery", {}).get("risk_level"),
                    "archetype": profile.get("archetype", {}).get("label"),
                    "recorded_at": latest_data.get("recorded_at"),
                }
            )
            # Reuse chargers already fetched inside live_driver_profile to avoid
            # a redundant Places API call per driver per tick.
            nearest = profile.get("charging", {}).get("nearest_charger")
            if nearest and nearest.get("lat") is not None and nearest.get("lng") is not None:
                key = f"{nearest.get('name')}:{nearest.get('lat')}:{nearest.get('lng')}"
                charger_points[key] = nearest
        low_soc_zones.extend(profile.get("location", {}).get("low_soc_zones") or [])
        stop_zones.extend(profile.get("location", {}).get("frequent_stop_zones") or [])

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "vehicle_points": vehicle_points,
        "low_soc_zones": low_soc_zones[:20],
        "frequent_stop_zones": stop_zones[:20],
        "charger_points": sorted(charger_points.values(), key=lambda item: item.get("distance_m", 999999))[:20],
    }


def weekly_live_metrics(db: Session, user: User, days: int = 7) -> dict[str, Any]:
    days = min(max(days, 1), 31)
    since = datetime.utcnow() - timedelta(days=days)
    driver_query = db.query(Driver)
    if user.role == "fleet_operator":
        driver_query = driver_query.filter(Driver.fleet_id == user.fleet_id)
    elif user.role == "driver":
        driver_query = driver_query.filter(Driver.id == user.driver_id)
    drivers = driver_query.order_by(Driver.driver_code).limit(100).all()
    driver_ids = [driver.id for driver in drivers]

    telemetry_count = (
        db.query(Telemetry)
        .filter(Telemetry.driver_id.in_(driver_ids), Telemetry.recorded_at >= since)
        .count()
        if driver_ids
        else 0
    )
    waits = (
        db.query(WaitEvent)
        .filter(WaitEvent.driver_id.in_(driver_ids), WaitEvent.started_at >= since)
        .all()
        if driver_ids
        else []
    )
    nudges = (
        db.query(NudgeEvent)
        .filter(NudgeEvent.driver_id.in_(driver_ids), NudgeEvent.created_at >= since)
        .all()
        if driver_ids
        else []
    )
    fleet = fleet_live_overview(db, user, window_minutes=days * 24 * 60)
    wait_counts: dict[str, int] = {}
    for wait in waits:
        wait_counts[wait.wait_type] = wait_counts.get(wait.wait_type, 0) + 1

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "period": {"days": days, "since": since.isoformat()},
        "fleet_summary": fleet["summary"],
        "telemetry_rows": telemetry_count,
        "wait_event_count": len(waits),
        "wait_type_counts": wait_counts,
        "nudge_count": len(nudges),
        "top_battery_risk": fleet["risk_lists"]["battery_risk"][:5],
        "charging_opportunities": fleet["risk_lists"]["charging_opportunities"][:5],
        "driver_count": len(drivers),
    }
