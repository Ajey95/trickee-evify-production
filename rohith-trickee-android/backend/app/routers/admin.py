import json
from datetime import datetime
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    AccessRequest,
    Alert,
    ChargingDecisionRecord,
    Driver,
    DriverBehaviorSnapshot,
    Fleet,
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
from app.services.audit import record_security_event
from app.services.auth import require_roles
from app.services.serializers import access_request_dict, driver_dict, user_dict

router = APIRouter(prefix="/admin", tags=["admin"])


class AccessRequestCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    company: str | None = Field(default=None, max_length=255)
    requested_role: Literal["trickee_admin", "fleet_operator", "driver"] = "fleet_operator"
    requested_vehicle_id: str | None = Field(default=None, max_length=36)
    supabase_user_id: str | None = Field(default=None, max_length=128)


class AccessApprovalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["trickee_admin", "fleet_operator", "driver"]
    fleet_id: str | None = Field(default=None, max_length=36)
    driver_id: str | None = Field(default=None, max_length=36)
    requested_vehicle_id: str | None = Field(default=None, max_length=36)
    full_name: str | None = Field(default=None, max_length=255)
    review_note: str | None = Field(default=None, max_length=255)


class AccessRejectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    review_note: str | None = Field(default=None, max_length=255)


class UserMappingUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["trickee_admin", "fleet_operator", "driver"]
    fleet_id: str | None = Field(default=None, max_length=36)
    driver_id: str | None = Field(default=None, max_length=36)
    requested_vehicle_id: str | None = Field(default=None, max_length=36)
    full_name: str | None = Field(default=None, max_length=255)
    is_active: bool = True


def _fleet_dict(fleet: Fleet) -> dict:
    return {"id": fleet.id, "name": fleet.name, "city": fleet.city}


def _get_access_request(db: Session, request_id: str) -> AccessRequest:
    row = db.get(AccessRequest, request_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Access request not found")
    return row


def _validate_access_mapping(db: Session, payload: AccessApprovalRequest) -> tuple[Fleet | None, Driver | None]:
    fleet = None
    driver = None
    requested_vehicle = None
    if payload.role in {"fleet_operator", "driver"}:
        if not payload.fleet_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Fleet is required")
        fleet = db.get(Fleet, payload.fleet_id)
        if not fleet or fleet.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fleet not found")
    if payload.requested_vehicle_id:
        requested_vehicle = db.get(Vehicle, payload.requested_vehicle_id)
        if not requested_vehicle or requested_vehicle.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requested vehicle not found")
        if fleet and requested_vehicle.fleet_id != fleet.id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Requested vehicle does not belong to this fleet")
    if payload.role == "driver":
        if not payload.driver_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Driver is required")
        driver = db.get(Driver, payload.driver_id)
        if not driver or driver.deleted_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")
        if fleet and driver.fleet_id != fleet.id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Driver does not belong to this fleet")
    return fleet, driver


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


@router.patch("/users/{user_id}/mapping")
def update_user_mapping(
    user_id: str,
    payload: UserMappingUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin")),
):
    user = db.get(User, user_id)
    if not user or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    previous = {
        "role": user.role,
        "fleet_id": user.fleet_id,
        "driver_id": user.driver_id,
        "is_active": user.is_active,
    }
    _validate_access_mapping(db, payload)

    if payload.full_name is not None:
        user.full_name = payload.full_name.strip() or user.full_name
    user.role = payload.role
    user.fleet_id = payload.fleet_id if payload.role in {"fleet_operator", "driver"} else None
    user.driver_id = payload.driver_id if payload.role == "driver" else None
    user.is_active = payload.is_active
    user.deleted_at = None

    record_security_event(
        db,
        event_type="admin_user_mapping_updated",
        request=request,
        user=current_user,
        metadata={
            "target_domain": user.email.split("@")[-1],
            "target_user_id": user.id,
            "previous": previous,
            "updated": {
                "role": user.role,
                "fleet_id": user.fleet_id,
                "driver_id": user.driver_id,
                "is_active": user.is_active,
            },
        },
    )
    db.commit()
    db.refresh(user)
    return ok(user_dict(user))


@router.get("/fleets")
def fleets(db: Session = Depends(get_db), _: User = Depends(require_roles("trickee_admin"))):
    rows = db.query(Fleet).filter(Fleet.deleted_at.is_(None)).order_by(Fleet.name).all()
    return ok([_fleet_dict(row) for row in rows])


@router.get("/drivers")
def drivers(db: Session = Depends(get_db), _: User = Depends(require_roles("trickee_admin"))):
    rows = db.query(Driver).filter(Driver.deleted_at.is_(None)).order_by(Driver.full_name).all()
    return ok([driver_dict(row) for row in rows])


@router.get("/access-requests")
def access_requests(db: Session = Depends(get_db), _: User = Depends(require_roles("trickee_admin"))):
    pending = db.query(AccessRequest).filter(AccessRequest.status == "pending").order_by(AccessRequest.created_at.desc()).limit(100).all()
    reviewed = db.query(AccessRequest).filter(AccessRequest.status != "pending").order_by(AccessRequest.created_at.desc()).limit(100).all()
    rows = pending + reviewed
    return ok([access_request_dict(row) for row in rows])


@router.post("/access-requests")
def create_access_request(
    payload: AccessRequestCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin")),
):
    email = payload.email.lower()
    row = db.query(AccessRequest).filter(AccessRequest.email == email).first()
    if not row:
        row = AccessRequest(
            email=email,
            full_name=payload.full_name,
            company=payload.company,
            requested_role=payload.requested_role,
            requested_vehicle_id=payload.requested_vehicle_id,
            supabase_user_id=payload.supabase_user_id,
        )
        db.add(row)
    elif row.status == "pending":
        row.full_name = payload.full_name
        row.company = payload.company
        row.requested_role = payload.requested_role
        row.requested_vehicle_id = payload.requested_vehicle_id
        row.supabase_user_id = payload.supabase_user_id or row.supabase_user_id
    else:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Access request already reviewed")
    record_security_event(
        db,
        event_type="access_request_created_by_admin",
        request=request,
        user=current_user,
        metadata={"target_domain": email.split("@")[-1], "requested_role": payload.requested_role},
    )
    db.commit()
    db.refresh(row)
    return ok(access_request_dict(row))


@router.post("/access-requests/{request_id}/approve")
def approve_access_request(
    request_id: str,
    payload: AccessApprovalRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin")),
):
    row = _get_access_request(db, request_id)
    if row.status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Access request already reviewed")
    _validate_access_mapping(db, payload)

    user = db.query(User).filter(User.email == row.email).first()
    if row.supabase_user_id:
        existing_identity = db.query(User).filter(User.supabase_user_id == row.supabase_user_id).first()
        if existing_identity and (not user or existing_identity.id != user.id):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Identity already belongs to another user")
    if not user:
        user = User(
            email=row.email,
            full_name=payload.full_name or row.full_name,
            role=payload.role,
            auth_provider="supabase",
            supabase_user_id=row.supabase_user_id,
            is_active=True,
        )
        db.add(user)
    else:
        user.full_name = payload.full_name or user.full_name or row.full_name
        user.role = payload.role
        user.auth_provider = "supabase"
        user.supabase_user_id = row.supabase_user_id or user.supabase_user_id
        user.is_active = True
        user.deleted_at = None
    user.fleet_id = payload.fleet_id if payload.role in {"fleet_operator", "driver"} else None
    user.driver_id = payload.driver_id if payload.role == "driver" else None

    row.status = "approved"
    row.requested_vehicle_id = payload.requested_vehicle_id or row.requested_vehicle_id
    row.reviewed_by_user_id = current_user.id
    row.reviewed_at = datetime.utcnow()
    row.review_note = payload.review_note
    record_security_event(
        db,
        event_type="access_request_approved",
        request=request,
        user=current_user,
        metadata={"target_domain": row.email.split("@")[-1], "approved_role": payload.role},
    )
    db.commit()
    db.refresh(row)
    db.refresh(user)
    return ok({"access_request": access_request_dict(row), "user": user_dict(user)})


@router.post("/access-requests/{request_id}/reject")
def reject_access_request(
    request_id: str,
    payload: AccessRejectRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("trickee_admin")),
):
    row = _get_access_request(db, request_id)
    if row.status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Access request already reviewed")
    row.status = "rejected"
    row.reviewed_by_user_id = current_user.id
    row.reviewed_at = datetime.utcnow()
    row.review_note = payload.review_note
    record_security_event(
        db,
        event_type="access_request_rejected",
        request=request,
        user=current_user,
        metadata={"target_domain": row.email.split("@")[-1], "requested_role": row.requested_role},
    )
    db.commit()
    db.refresh(row)
    return ok(access_request_dict(row))
