import json
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Alert,
    ChargingDecisionRecord,
    Driver,
    DriverBehaviorSnapshot,
    NudgeEvent,
    OrderAssignmentDecision,
    Prediction,
    SecurityEvent,
    Telemetry,
    Trip,
    User,
    Vehicle,
    WaitEvent,
)
from app.schemas.api import ok
from app.services.ai_engine import FEATURE_COLS, SEQ_LEN, ai_engine
from app.services.auth import require_roles
from app.services.serializers import user_dict

router = APIRouter(prefix="/admin", tags=["admin"])


def _v5a_candidate() -> dict | None:
    path = Path("models_ml") / "v5a_training_report.json"
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as handle:
        report = json.load(handle)
    return {
        "name": "battery_model_v5a",
        "ready_for_promotion": report.get("best", {}).get("mae", 999) < 0.41,
        "feature_count": report.get("feature_count"),
        "best": report.get("best"),
        "raw_rows": report.get("raw_rows"),
        "sequences": report.get("sequences"),
    }


@router.get("/metrics")
def metrics(db: Session = Depends(get_db), _: User = Depends(require_roles("trickee_admin"))):
    return ok(
        {
            "model": {
                "name": "battery_model_v4_1",
                "ready": ai_engine.ready,
                "seq_len": SEQ_LEN,
                "feature_count": len(FEATURE_COLS),
                "feature_columns": FEATURE_COLS,
                "target": "delta_soc",
                "delta_soc_input": False,
            },
            "v5a_candidate": _v5a_candidate(),
            "roadmap_features": {
                "driver_behavior_v5a": True,
                "external_context_v5b": True,
                "personalized_nudges_v5c": True,
                "smart_order_assignment_v5d": True,
                "wait_time_charging_v5d": True,
                "wait_classifier": True,
                "charging_decision_engine_v5d": True,
            },
            "counts": {
                "users": db.query(User).count(),
                "vehicles": db.query(Vehicle).count(),
                "drivers": db.query(Driver).count(),
                "telemetry": db.query(Telemetry).count(),
                "trips": db.query(Trip).count(),
                "predictions": db.query(Prediction).count(),
                "alerts": db.query(Alert).count(),
                "driver_behavior_snapshots": db.query(DriverBehaviorSnapshot).count(),
                "nudge_events": db.query(NudgeEvent).count(),
                "order_assignment_decisions": db.query(OrderAssignmentDecision).count(),
                "charging_decision_records": db.query(ChargingDecisionRecord).count(),
                "wait_events": db.query(WaitEvent).count(),
                "security_events": db.query(SecurityEvent).count(),
            },
        }
    )


@router.get("/users")
def users(db: Session = Depends(get_db), _: User = Depends(require_roles("trickee_admin"))):
    return ok([user_dict(user) for user in db.query(User).filter(User.deleted_at.is_(None)).order_by(User.email).all()])
