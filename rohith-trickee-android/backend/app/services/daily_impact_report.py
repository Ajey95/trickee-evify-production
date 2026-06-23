from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models import Alert, ChargingDecisionRecord, Driver, NudgeEvent, OrderAssignmentDecision, Telemetry, Trip, User, WaitEvent


CHARGER_KW = 1.2
CHARGE_COST_PER_KWH_INR = 18.0
DRIVER_TIME_VALUE_PER_HOUR_INR = 120.0
LOW_SOC_RISK_VALUE_INR = 80.0
AVG_ORDER_MINUTES = 28.0


def _period_bounds(report_date: date | None = None) -> tuple[datetime, datetime]:
    selected = report_date or datetime.utcnow().date()
    start = datetime.combine(selected, time.min)
    return start, start + timedelta(days=1)


def _driver_scope(db: Session, user: User) -> list[Driver]:
    query = db.query(Driver)
    if user.role == "fleet_operator":
        query = query.filter(Driver.fleet_id == user.fleet_id)
    elif user.role == "driver":
        query = query.filter(Driver.id == user.driver_id)
    return query.order_by(Driver.driver_code).limit(250).all()


def _float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _chargeable_minutes(record: ChargingDecisionRecord) -> float:
    wait_window = record.wait_window or {}
    result_payload = record.result_payload or {}
    chargeable = _float(wait_window.get("chargeable_min"))
    if chargeable <= 0:
        chargeable = _float((result_payload.get("wait_window") or {}).get("chargeable_min"))
    if record.chosen_option == "OPTION_A":
        return min(max(chargeable, 0.0), 30.0)
    if record.chosen_option == "OPTION_B":
        return min(max(chargeable * 0.35, 0.0), 12.0)
    return 0.0


def _impact_for_driver(
    *,
    driver: Driver,
    trips: list[Trip],
    charging_decisions: list[ChargingDecisionRecord],
    order_decisions: list[OrderAssignmentDecision],
    alerts: list[Alert],
    nudges: list[NudgeEvent],
    waits: list[WaitEvent],
    telemetry_rows: int,
) -> dict[str, Any]:
    completed_trips = [trip for trip in trips if trip.ended_at]
    delivered_orders = len(completed_trips) or len({row.order_id for row in order_decisions if row.order_id})
    distance_km = round(sum(_float(trip.distance_km) for trip in completed_trips), 2)
    kwh_used = round(sum(_float(trip.kwh_used) for trip in completed_trips), 3)

    optimized_charging = [row for row in charging_decisions if row.chosen_option in {"OPTION_A", "OPTION_B"}]
    charge_minutes = round(sum(_chargeable_minutes(row) for row in optimized_charging), 1)
    charging_kwh_captured = round((charge_minutes / 60.0) * CHARGER_KW, 2)
    charge_value_captured_inr = round(charging_kwh_captured * CHARGE_COST_PER_KWH_INR)

    wait_minutes = round(sum(max(wait.duration_seconds or 0, 0) for wait in waits) / 60.0, 1)
    assignment_minutes = 0.0
    for row in order_decisions:
        if row.strategy in {"low_soc_wait_time_charging", "stop_wait_optimizer_charging"}:
            assignment_minutes += min(_float(row.restaurant_wait_min) * 0.5, 12.0)

    time_saved_min = round(charge_minutes + assignment_minutes, 1)
    low_soc_risks_avoided = len(
        [
            alert
            for alert in alerts
            if alert.is_resolved and alert.alert_type in {"low_soc_parked", "driver_risk", "charging_opportunity"}
        ]
    )
    acknowledged_nudges = len([nudge for nudge in nudges if nudge.acknowledged_at or nudge.status in {"acknowledged", "followed"}])
    extra_orders_enabled = int(time_saved_min // AVG_ORDER_MINUTES)
    operating_value_inr = round(
        (time_saved_min / 60.0) * DRIVER_TIME_VALUE_PER_HOUR_INR
        + charge_value_captured_inr
        + low_soc_risks_avoided * LOW_SOC_RISK_VALUE_INR
    )

    confidence = "high" if telemetry_rows >= 50 and (completed_trips or charging_decisions) else "medium" if telemetry_rows else "low"
    headline = (
        f"{driver.driver_code} saved {time_saved_min:.0f} min and completed {delivered_orders} orders."
        if delivered_orders or time_saved_min
        else f"{driver.driver_code} is ready for fresh activity."
    )

    return {
        "driver_id": driver.id,
        "driver_code": driver.driver_code,
        "driver_name": driver.full_name,
        "headline": headline,
        "confidence": confidence,
        "metrics": {
            "delivered_orders": delivered_orders,
            "distance_km": distance_km,
            "kwh_used": kwh_used,
            "time_saved_min": time_saved_min,
            "charge_minutes_captured": charge_minutes,
            "charging_kwh_captured": charging_kwh_captured,
            "charge_value_captured_inr": charge_value_captured_inr,
            "extra_orders_enabled": extra_orders_enabled,
            "low_soc_risks_avoided": low_soc_risks_avoided,
            "acknowledged_nudges": acknowledged_nudges,
            "optimized_charging_sessions": len(optimized_charging),
            "wait_minutes": wait_minutes,
            "operating_value_inr": operating_value_inr,
            "telemetry_rows": telemetry_rows,
        },
    }


def build_daily_impact_report(db: Session, user: User, report_date: date | None = None) -> dict[str, Any]:
    start, end = _period_bounds(report_date)
    drivers = _driver_scope(db, user)
    driver_ids = [driver.id for driver in drivers]
    if not driver_ids:
        return {
            "generated_at": datetime.utcnow().isoformat(),
            "period": {"date": start.date().isoformat(), "start": start.isoformat(), "end": end.isoformat()},
            "summary": {
                "delivered_orders": 0,
                "time_saved_min": 0,
                "charge_value_captured_inr": 0,
                "extra_orders_enabled": 0,
                "low_soc_risks_avoided": 0,
                "operating_value_inr": 0,
                "confidence": "low",
            },
            "headline": "No assigned drivers yet.",
            "driver_reports": [],
            "tool_evidence": [],
        }

    trips = (
        db.query(Trip)
        .filter(Trip.driver_id.in_(driver_ids), Trip.started_at >= start, Trip.started_at < end)
        .all()
    )
    charging_decisions = (
        db.query(ChargingDecisionRecord)
        .filter(
            ChargingDecisionRecord.created_at >= start,
            ChargingDecisionRecord.created_at < end,
            or_(ChargingDecisionRecord.driver_id.in_(driver_ids), ChargingDecisionRecord.driver_id.in_([driver.driver_code for driver in drivers])),
        )
        .all()
    )
    order_decisions = (
        db.query(OrderAssignmentDecision)
        .filter(OrderAssignmentDecision.created_at >= start, OrderAssignmentDecision.created_at < end)
        .filter(
            or_(
                OrderAssignmentDecision.assigned_driver_id.in_(driver_ids),
                OrderAssignmentDecision.assigned_driver_id.in_([driver.driver_code for driver in drivers]),
            )
        )
        .all()
    )
    alerts = (
        db.query(Alert)
        .filter(Alert.created_at >= start, Alert.created_at < end, Alert.driver_id.in_(driver_ids))
        .all()
    )
    nudges = (
        db.query(NudgeEvent)
        .filter(NudgeEvent.created_at >= start, NudgeEvent.created_at < end, NudgeEvent.driver_id.in_(driver_ids))
        .all()
    )
    waits = (
        db.query(WaitEvent)
        .filter(WaitEvent.started_at >= start, WaitEvent.started_at < end, WaitEvent.driver_id.in_(driver_ids))
        .all()
    )
    telemetry_count_by_driver: dict[str, int] = {}
    if driver_ids:
        grouped = (
            db.query(Telemetry.driver_id, func.count(Telemetry.id))
            .filter(Telemetry.recorded_at >= start, Telemetry.recorded_at < end, Telemetry.driver_id.in_(driver_ids))
            .group_by(Telemetry.driver_id)
            .all()
        )
        telemetry_count_by_driver = {str(driver_id): int(count) for driver_id, count in grouped}

    trips_by_driver: dict[str, list[Trip]] = {driver_id: [] for driver_id in driver_ids}
    charging_by_driver: dict[str, list[ChargingDecisionRecord]] = {driver_id: [] for driver_id in driver_ids}
    orders_by_driver: dict[str, list[OrderAssignmentDecision]] = {driver_id: [] for driver_id in driver_ids}
    alerts_by_driver: dict[str, list[Alert]] = {driver_id: [] for driver_id in driver_ids}
    nudges_by_driver: dict[str, list[NudgeEvent]] = {driver_id: [] for driver_id in driver_ids}
    waits_by_driver: dict[str, list[WaitEvent]] = {driver_id: [] for driver_id in driver_ids}
    code_to_id = {driver.driver_code: driver.id for driver in drivers}

    for trip in trips:
        trips_by_driver.setdefault(trip.driver_id, []).append(trip)
    for row in charging_decisions:
        mapped_id = code_to_id.get(str(row.driver_id), str(row.driver_id))
        if mapped_id in charging_by_driver:
            charging_by_driver[mapped_id].append(row)
    for row in order_decisions:
        mapped_id = code_to_id.get(str(row.assigned_driver_id), str(row.assigned_driver_id))
        if mapped_id in orders_by_driver:
            orders_by_driver[mapped_id].append(row)
    for row in alerts:
        if row.driver_id:
            alerts_by_driver.setdefault(row.driver_id, []).append(row)
    for row in nudges:
        if row.driver_id:
            nudges_by_driver.setdefault(row.driver_id, []).append(row)
    for row in waits:
        if row.driver_id:
            waits_by_driver.setdefault(row.driver_id, []).append(row)

    driver_reports = [
        _impact_for_driver(
            driver=driver,
            trips=trips_by_driver.get(driver.id, []),
            charging_decisions=charging_by_driver.get(driver.id, []),
            order_decisions=orders_by_driver.get(driver.id, []),
            alerts=alerts_by_driver.get(driver.id, []),
            nudges=nudges_by_driver.get(driver.id, []),
            waits=waits_by_driver.get(driver.id, []),
            telemetry_rows=telemetry_count_by_driver.get(driver.id, 0),
        )
        for driver in drivers
    ]
    driver_reports.sort(key=lambda row: row["metrics"]["operating_value_inr"], reverse=True)

    total = {
        "delivered_orders": sum(row["metrics"]["delivered_orders"] for row in driver_reports),
        "distance_km": round(sum(row["metrics"]["distance_km"] for row in driver_reports), 2),
        "kwh_used": round(sum(row["metrics"]["kwh_used"] for row in driver_reports), 3),
        "time_saved_min": round(sum(row["metrics"]["time_saved_min"] for row in driver_reports), 1),
        "charge_minutes_captured": round(sum(row["metrics"]["charge_minutes_captured"] for row in driver_reports), 1),
        "charging_kwh_captured": round(sum(row["metrics"]["charging_kwh_captured"] for row in driver_reports), 2),
        "charge_value_captured_inr": sum(row["metrics"]["charge_value_captured_inr"] for row in driver_reports),
        "extra_orders_enabled": sum(row["metrics"]["extra_orders_enabled"] for row in driver_reports),
        "low_soc_risks_avoided": sum(row["metrics"]["low_soc_risks_avoided"] for row in driver_reports),
        "acknowledged_nudges": sum(row["metrics"]["acknowledged_nudges"] for row in driver_reports),
        "optimized_charging_sessions": sum(row["metrics"]["optimized_charging_sessions"] for row in driver_reports),
        "wait_minutes": round(sum(row["metrics"]["wait_minutes"] for row in driver_reports), 1),
        "operating_value_inr": sum(row["metrics"]["operating_value_inr"] for row in driver_reports),
        "telemetry_rows": sum(row["metrics"]["telemetry_rows"] for row in driver_reports),
    }
    confidence = "high" if total["telemetry_rows"] >= 50 else "medium" if total["telemetry_rows"] else "low"
    total["confidence"] = confidence
    headline = (
        f"Saved {total['time_saved_min']:.0f} min, protected {total['low_soc_risks_avoided']} trips, and completed {total['delivered_orders']} orders."
        if total["telemetry_rows"] or total["delivered_orders"]
        else "No operating activity captured for this day."
    )

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "period": {"date": start.date().isoformat(), "start": start.isoformat(), "end": end.isoformat()},
        "headline": headline,
        "summary": total,
        "driver_reports": driver_reports,
        "tool_evidence": [
            {"tool": "trips", "records": len(trips), "source": "trips"},
            {"tool": "charging_decisions", "records": len(charging_decisions), "source": "charging_decision_records"},
            {"tool": "nudges", "records": len(nudges), "source": "nudge_events"},
            {"tool": "alerts", "records": len(alerts), "source": "alerts"},
            {"tool": "waits", "records": len(waits), "source": "wait_events"},
            {"tool": "telemetry", "records": total["telemetry_rows"], "source": "telemetry"},
        ],
        "assumptions": {
            "charger_kw": CHARGER_KW,
            "charge_cost_per_kwh_inr": CHARGE_COST_PER_KWH_INR,
            "driver_time_value_per_hour_inr": DRIVER_TIME_VALUE_PER_HOUR_INR,
            "avg_order_minutes": AVG_ORDER_MINUTES,
        },
    }
