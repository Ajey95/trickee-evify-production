from typing import Any

import logging
import time

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User
from app.schemas.api import ok
from app.services.auth import require_roles
from app.services.rate_limit import check_rate_limit
from app.services.telemetry_ingest import ingest_evify_payload
from app.services.serializers import alert_dict, telemetry_dict

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
