from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import ChargingDecisionRecord, NudgeEvent, OrderAssignmentDecision, User


def _driver_identifier(driver: dict[str, Any] | None) -> str | None:
    if not driver:
        return None
    return str(driver.get("id") or driver.get("driver_id") or driver.get("driver_code") or "") or None


def persist_order_assignment(
    db: Session,
    *,
    user: User,
    available_drivers: list[dict[str, Any]],
    order: dict[str, Any],
    result: dict[str, Any],
) -> OrderAssignmentDecision:
    assigned = result.get("assigned_driver") or {}
    record = OrderAssignmentDecision(
        fleet_id=user.fleet_id,
        order_id=order.get("order_id"),
        assigned_driver_id=_driver_identifier(assigned),
        strategy=assigned.get("strategy") or result.get("reason"),
        restaurant_wait_min=order.get("restaurant_wait_min"),
        delivery_distance_km=order.get("delivery_distance_km"),
        required_range_km=assigned.get("required_range_km"),
        assignment_score=assigned.get("assignment_score"),
        request_payload={"available_drivers": available_drivers, "order": order},
        result_payload=result,
        outcome="pending",
    )
    db.add(record)
    db.flush()
    return record


def persist_charging_decision(
    db: Session,
    *,
    driver: dict[str, Any],
    order: dict[str, Any],
    result: dict[str, Any],
) -> ChargingDecisionRecord:
    record = ChargingDecisionRecord(
        driver_id=_driver_identifier(driver),
        vehicle_id=driver.get("vehicle_id"),
        order_id=order.get("order_id"),
        chosen_option=result["chosen_option"],
        message=result["message"],
        selected_charger=result.get("selected_charger"),
        wait_window=result.get("wait_window"),
        request_payload={"driver": driver, "order": order},
        result_payload=result,
        outcome="pending",
    )
    db.add(record)
    db.flush()
    if result.get("message"):
        db.add(
            NudgeEvent(
                driver_id=driver.get("id") if driver.get("id") else None,
                vehicle_id=driver.get("vehicle_id"),
                nudge_type="charging_decision",
                channel="dashboard",
                message=result["message"],
                payload=result,
                status="created",
            )
        )
    return record
