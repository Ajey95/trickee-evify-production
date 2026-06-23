from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import Alert, DevicePushToken, NudgeEvent, User, Vehicle
from app.schemas.api import ok
from app.services.auth import get_current_user
from app.services.firebase_service import send_fcm_notification
from app.services.rate_limit import check_rate_limit
from app.services.serializers import alert_dict

router = APIRouter(prefix="/alerts", tags=["alerts"])


class TestPushRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(default="Trickee test alert", min_length=1, max_length=80)
    body: str = Field(default="Browser push notifications are connected.", min_length=1, max_length=220)


@router.get("")
def list_alerts(
    unresolved_only: bool = False,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Alert)
    if current_user.role == "fleet_operator":
        vehicle_ids = [v.id for v in db.query(Vehicle).filter(Vehicle.fleet_id == current_user.fleet_id).all()]
        query = query.filter(Alert.vehicle_id.in_(vehicle_ids))
    elif current_user.role == "driver":
        query = query.filter(Alert.driver_id == current_user.driver_id)
    if unresolved_only:
        query = query.filter(Alert.is_resolved.is_(False))
    rows = query.order_by(desc(Alert.created_at)).limit(min(limit, 300)).all()
    return ok([alert_dict(row) for row in rows])


def _assert_alert_access(db: Session, alert: Alert, user: User) -> None:
    if user.role == "trickee_admin":
        return
    if user.role == "driver" and alert.driver_id == user.driver_id:
        return
    if user.role == "fleet_operator":
        vehicle = db.get(Vehicle, alert.vehicle_id)
        if vehicle and vehicle.fleet_id == user.fleet_id:
            return
    raise HTTPException(status_code=403, detail="Alert not in user's scope")


@router.post("/{alert_id}/resolve")
def resolve_alert(alert_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    _assert_alert_access(db, alert, current_user)
    alert.is_resolved = True
    db.commit()
    db.refresh(alert)
    return ok(alert_dict(alert), "Alert resolved")


@router.post("/test-push")
async def send_test_push(
    payload: TestPushRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await check_rate_limit(
        request=request,
        namespace="test-push",
        limit=get_settings().auth_rate_limit_per_minute,
        subject=f"user:{current_user.id}",
    )
    tokens = [
        row.token
        for row in db.query(DevicePushToken)
        .filter(DevicePushToken.user_id == current_user.id, DevicePushToken.is_active.is_(True))
        .all()
    ]
    if not tokens:
        raise HTTPException(status_code=409, detail="No active browser push token is registered for this user")

    result = send_fcm_notification(
        tokens=tokens,
        title=payload.title,
        body=payload.body,
        data={"type": "test_push", "user_id": current_user.id},
    )
    db.add(
        NudgeEvent(
            driver_id=current_user.driver_id,
            vehicle_id=None,
            alert_id=None,
            nudge_type="test_push",
            channel="fcm",
            message=payload.body,
            payload=result,
            status="sent" if result.get("sent", 0) > 0 else "failed",
        )
    )
    db.commit()
    return ok(result, "Test push attempted")
