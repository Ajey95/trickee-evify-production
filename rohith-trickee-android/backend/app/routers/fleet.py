from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User
from app.schemas.api import ok
from app.services.ai_features import fleet_summary
from app.services.auth import require_roles
from app.services.rate_limit import check_rate_limit

router = APIRouter(prefix="/fleet", tags=["fleet"])


class FleetSummaryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fleet_id: str | None = Field(default=None, max_length=64)
    summary_type: Literal["realtime", "daily"] = "realtime"
    timestamp: datetime | None = None


@router.post("/summary")
async def create_fleet_summary(
    payload: FleetSummaryRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    settings = get_settings()
    fleet_id = payload.fleet_id or current_user.fleet_id
    if current_user.role == "fleet_operator" and payload.fleet_id and payload.fleet_id != current_user.fleet_id:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Fleet not in user's scope")
    await check_rate_limit(
        request=request,
        namespace="fleet-summary",
        limit=settings.fleet_summary_rate_limit_per_hour,
        window_seconds=3600,
        subject=f"user:{current_user.id}",
    )
    result = fleet_summary(db, current_user, fleet_id, payload.summary_type)
    db.commit()
    return ok(result)
