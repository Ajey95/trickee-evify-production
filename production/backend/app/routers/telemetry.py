from typing import Any

import logging
import time

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import Driver, User, Vehicle
from app.schemas.api import ok
from app.services.auth import require_roles
from app.services.rate_limit import check_rate_limit
from app.services.telemetry_ingest import ingest_evify_payload, live_vehicle_point
from app.services.serializers import alert_dict, telemetry_dict
from app.services.ws_manager import manager

router = APIRouter(prefix="/telemetry", tags=["telemetry"])
MAX_BULK_TELEMETRY_ROWS = 500
logger = logging.getLogger(__name__)


class EvifyIngestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    payload: dict[str, Any]


@router.post("/evify")
async def ingest_evify(
    request: EvifyIngestRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    started_at = time.perf_counter()
    request_id = getattr(http_request.state, "request_id", "-")
    await check_rate_limit(
        request=http_request,
        namespace="telemetry-ingest",
        limit=get_settings().telemetry_rate_limit_per_minute,
        subject=f"user:{current_user.id}",
    )
    row, alert = ingest_evify_payload(db, request.payload, user=current_user)
    elapsed_ms = (time.perf_counter() - started_at) * 1000
    logger.info(
        "telemetry_ingest request_id=%s user_id=%s vehicle_id=%s driver_id=%s alert_created=%s elapsed_ms=%.2f",
        request_id,
        current_user.id,
        row.vehicle_id,
        row.driver_id,
        bool(alert),
        elapsed_ms,
    )
    data = {"telemetry": telemetry_dict(row), "alert": alert_dict(alert) if alert else None}
    return ok(data, "Telemetry ingested")


@router.post("/evify/bulk")
async def ingest_evify_bulk(
    request: list[dict[str, Any]],
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    started_at = time.perf_counter()
    request_id = getattr(http_request.state, "request_id", "-")
    await check_rate_limit(
        request=http_request,
        namespace="telemetry-bulk-ingest",
        limit=max(1, get_settings().telemetry_rate_limit_per_minute // 4),
        subject=f"user:{current_user.id}",
    )
    if not request:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Telemetry batch cannot be empty")
    if len(request) > MAX_BULK_TELEMETRY_ROWS:
        logger.warning(
            "telemetry_bulk_rejected request_id=%s user_id=%s rows=%s max_rows=%s reason=too_large",
            request_id,
            current_user.id,
            len(request),
            MAX_BULK_TELEMETRY_ROWS,
        )
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Bulk telemetry ingest is limited to {MAX_BULK_TELEMETRY_ROWS} rows per request",
        )
    rows = []
    for payload in request:
        row, _ = ingest_evify_payload(db, payload, user=current_user, commit=False)
        rows.append(row)
    db.commit()
    _publish_bulk_live_points(db, rows)
    elapsed_ms = (time.perf_counter() - started_at) * 1000
    vehicle_count = len({row.vehicle_id for row in rows})
    driver_count = len({row.driver_id for row in rows if row.driver_id})
    logger.info(
        "telemetry_bulk_ingest request_id=%s user_id=%s rows=%s vehicles=%s drivers=%s elapsed_ms=%.2f",
        request_id,
        current_user.id,
        len(rows),
        vehicle_count,
        driver_count,
        elapsed_ms,
    )
    return ok({"ingested": len(rows)}, "Telemetry batch ingested")


def _publish_bulk_live_points(db: Session, rows: list[Any]) -> None:
    if not rows:
        return
    latest_by_vehicle = {}
    for row in rows:
        current = latest_by_vehicle.get(row.vehicle_id)
        if not current or row.recorded_at > current.recorded_at:
            latest_by_vehicle[row.vehicle_id] = row

    vehicle_ids = set(latest_by_vehicle)
    driver_ids = {row.driver_id for row in latest_by_vehicle.values() if row.driver_id}
    vehicles = {vehicle.id: vehicle for vehicle in db.query(Vehicle).filter(Vehicle.id.in_(vehicle_ids)).all()}
    drivers = {driver.id: driver for driver in db.query(Driver).filter(Driver.id.in_(driver_ids)).all()} if driver_ids else {}

    redis_url = get_settings().redis_url
    for row in latest_by_vehicle.values():
        vehicle = vehicles.get(row.vehicle_id)
        if not vehicle:
            continue
        point = live_vehicle_point(row, vehicle, drivers.get(row.driver_id))
        if point:
            manager.schedule_vehicle_point_publish(point, redis_url)
