from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Prediction, User
from app.schemas.api import ok
from app.services.access import assert_vehicle_access
from app.services.ai_engine import ai_engine
from app.services.auth import get_current_user, require_roles
from app.services.serializers import prediction_dict

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.post("/infer/{vehicle_id}")
def infer_vehicle(
    vehicle_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin", "fleet_operator")),
):
    vehicle = assert_vehicle_access(db, current_user, vehicle_id)
    try:
        result = ai_engine.infer_vehicle(db, vehicle)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return ok({"prediction": prediction_dict(result.prediction), "feature_columns": result.feature_columns})


@router.get("/{vehicle_id}/history")
def prediction_history(
    vehicle_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vehicle = assert_vehicle_access(db, current_user, vehicle_id)
    rows = (
        db.query(Prediction)
        .filter(Prediction.vehicle_id == vehicle.id)
        .order_by(desc(Prediction.predicted_at))
        .limit(min(limit, 200))
        .all()
    )
    return ok([prediction_dict(row) for row in rows])
