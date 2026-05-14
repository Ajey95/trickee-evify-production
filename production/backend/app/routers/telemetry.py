from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas.api import ok
from app.services.auth import require_roles
from app.services.telemetry_ingest import ingest_evify_payload
from app.services.serializers import alert_dict, telemetry_dict

router = APIRouter(prefix="/telemetry", tags=["telemetry"])
MAX_BULK_TELEMETRY_ROWS = 500


class EvifyIngestRequest(BaseModel):
    payload: dict[str, Any]


@router.post("/evify")
def ingest_evify(
    request: EvifyIngestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    row, alert = ingest_evify_payload(db, request.payload, user=current_user)
    data = {"telemetry": telemetry_dict(row), "alert": alert_dict(alert) if alert else None}
    return ok(data, "Telemetry ingested")


@router.post("/evify/bulk")
def ingest_evify_bulk(
    request: list[dict[str, Any]],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    if len(request) > MAX_BULK_TELEMETRY_ROWS:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Bulk telemetry ingest is limited to {MAX_BULK_TELEMETRY_ROWS} rows per request",
        )
    rows = []
    for payload in request:
        row, _ = ingest_evify_payload(db, payload, user=current_user, commit=False)
        rows.append(row)
    db.commit()
    return ok({"ingested": len(rows)}, "Telemetry batch ingested")
