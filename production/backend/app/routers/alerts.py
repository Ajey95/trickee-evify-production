from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Alert, User, Vehicle
from app.schemas.api import ok
from app.services.auth import get_current_user
from app.services.serializers import alert_dict

router = APIRouter(prefix="/alerts", tags=["alerts"])


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
