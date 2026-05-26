from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import get_settings
from app.models import AccessRequest, DevicePushToken, Fleet, User, Vehicle
from app.schemas.api import ok
from app.services.audit import record_security_event
from app.services.auth import create_access_token, get_current_user, verify_password
from app.services.firebase_service import verify_firebase_id_token
from app.services.rate_limit import check_rate_limit, ip_rate_limit
from app.services.serializers import device_push_token_dict, user_dict

router = APIRouter(prefix="/auth", tags=["auth"])

LOGIN_WINDOW_MINUTES = 15
LOGIN_MAX_FAILURES = 8
WS_TICKET_TTL_MINUTES = 2
_login_failures: dict[str, list[datetime]] = {}


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class FirebaseLoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id_token: str = Field(min_length=20, max_length=4096)


class FcmTokenRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=20, max_length=4096)
    platform: str = Field(default="web", pattern="^(web|android|ios)$")
    device_label: str | None = Field(default=None, max_length=120)


class AccessRequestPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    company: str | None = Field(default=None, max_length=255)
    requested_role: str = Field(default="driver", pattern="^(fleet_operator|driver|trickee_admin)$")
    requested_vehicle_id: str | None = Field(default=None, max_length=36)
    supabase_user_id: str | None = Field(default=None, max_length=128)


def _login_key(request: Request, email: str) -> str:
    client = request.client.host if request.client else "unknown"
    return f"{client}:{email.lower()}"


def _prune_failures(key: str, now: datetime) -> list[datetime]:
    window_start = now - timedelta(minutes=LOGIN_WINDOW_MINUTES)
    failures = [when for when in _login_failures.get(key, []) if when >= window_start]
    if failures:
        _login_failures[key] = failures
    else:
        _login_failures.pop(key, None)
    return failures


def _assert_login_allowed(request: Request, email: str) -> str:
    key = _login_key(request, email)
    failures = _prune_failures(key, datetime.utcnow())
    if len(failures) >= LOGIN_MAX_FAILURES:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Try again later.",
        )
    return key


def _record_login_failure(key: str) -> None:
    now = datetime.utcnow()
    failures = _prune_failures(key, now)
    failures.append(now)
    _login_failures[key] = failures


def _session_payload(user: User) -> dict:
    token = create_access_token(
        {"sub": user.id, "role": user.role, "fleet_id": user.fleet_id, "driver_id": user.driver_id}
    )
    return {"access_token": token, "token_type": "bearer", "user": user_dict(user)}


@router.get("/signup-options")
def signup_options(
    db: Session = Depends(get_db),
    _: None = Depends(ip_rate_limit("signup-options", lambda: get_settings().auth_rate_limit_per_minute)),
):
    vehicles = db.query(Vehicle).filter(Vehicle.deleted_at.is_(None)).order_by(Vehicle.vehicle_code).limit(500).all()
    fleet_ids = {vehicle.fleet_id for vehicle in vehicles if vehicle.fleet_id}
    fleets = {
        fleet.id: fleet
        for fleet in db.query(Fleet).filter(Fleet.id.in_(fleet_ids)).all()
    } if fleet_ids else {}
    return ok(
        {
            "vehicles": [
                {
                    "id": vehicle.id,
                    "vehicle_code": vehicle.vehicle_code,
                    "fleet_id": vehicle.fleet_id,
                    "fleet_name": fleets.get(vehicle.fleet_id).name if vehicle.fleet_id in fleets else None,
                }
                for vehicle in vehicles
            ]
        }
    )


@router.post("/login")
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(ip_rate_limit("auth-login", lambda: get_settings().auth_rate_limit_per_minute)),
):
    if not get_settings().legacy_auth_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Legacy password login is disabled")
    login_key = _assert_login_allowed(request, payload.email)
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        _record_login_failure(login_key)
        record_security_event(
            db,
            event_type="legacy_login_failed",
            request=request,
            metadata={"email_domain": payload.email.split("@")[-1]},
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        record_security_event(db, event_type="legacy_login_inactive_user", request=request, user=user)
        db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
    _login_failures.pop(login_key, None)
    record_security_event(db, event_type="legacy_login_success", request=request, user=user)
    db.commit()
    return ok(_session_payload(user))


@router.post("/firebase-login")
def firebase_login(
    payload: FirebaseLoginRequest,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(ip_rate_limit("firebase-login", lambda: get_settings().auth_rate_limit_per_minute)),
):
    decoded = verify_firebase_id_token(payload.id_token)
    firebase_uid = decoded.get("uid")
    email = decoded.get("email")
    if not firebase_uid or not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Firebase token must include uid and email")

    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
    if not user:
        record_security_event(db, event_type="firebase_login_unmapped_user", request=request, metadata={"email_domain": email.split("@")[-1]})
        db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Firebase user is not mapped in Trickee")
    if not user.is_active:
        record_security_event(db, event_type="firebase_login_inactive_user", request=request, user=user)
        db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")

    if user.firebase_uid != firebase_uid or user.auth_provider != "firebase":
        user.firebase_uid = firebase_uid
        user.auth_provider = "firebase"
        db.commit()
        db.refresh(user)

    record_security_event(db, event_type="firebase_login_success", request=request, user=user)
    db.commit()
    return ok(_session_payload(user))


@router.post("/access-request")
def request_workspace_access(
    payload: AccessRequestPayload,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(ip_rate_limit("access-request", lambda: get_settings().auth_rate_limit_per_minute)),
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
        row.full_name = payload.full_name or row.full_name
        row.company = payload.company or row.company
        row.requested_role = payload.requested_role
        row.requested_vehicle_id = payload.requested_vehicle_id
        row.supabase_user_id = payload.supabase_user_id or row.supabase_user_id
    record_security_event(
        db,
        event_type="workspace_access_requested",
        request=request,
        metadata={"email_domain": email.split("@")[-1], "requested_role": payload.requested_role},
    )
    db.commit()
    return ok({"status": "received"}, "Access request received")


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return ok(user_dict(current_user))


@router.get("/ws-ticket")
async def ws_ticket(request: Request, current_user: User = Depends(get_current_user)):
    await check_rate_limit(
        request=request,
        namespace="ws-ticket",
        limit=get_settings().websocket_ticket_rate_limit_per_minute,
        subject=f"user:{current_user.id}",
    )
    ticket = create_access_token(
        {
            "sub": current_user.id,
            "role": current_user.role,
            "fleet_id": current_user.fleet_id,
            "driver_id": current_user.driver_id,
            "purpose": "ws_live_map",
        },
        expire_minutes=WS_TICKET_TTL_MINUTES,
    )
    return ok({"ticket": ticket, "expires_in_seconds": WS_TICKET_TTL_MINUTES * 60})


@router.post("/fcm-token")
async def register_fcm_token(
    payload: FcmTokenRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await check_rate_limit(
        request=request,
        namespace="fcm-token",
        limit=get_settings().auth_rate_limit_per_minute,
        subject=f"user:{current_user.id}",
    )
    token = db.query(DevicePushToken).filter(DevicePushToken.token == payload.token).first()
    if token:
        token.user_id = current_user.id
        token.platform = payload.platform
        token.device_label = payload.device_label
        token.is_active = True
    else:
        token = DevicePushToken(
            user_id=current_user.id,
            token=payload.token,
            platform=payload.platform,
            device_label=payload.device_label,
            is_active=True,
        )
        db.add(token)
    db.commit()
    db.refresh(token)
    return ok(device_push_token_dict(token), "FCM token registered")


@router.delete("/fcm-token")
async def unregister_fcm_token(
    payload: FcmTokenRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await check_rate_limit(
        request=request,
        namespace="fcm-token",
        limit=get_settings().auth_rate_limit_per_minute,
        subject=f"user:{current_user.id}",
    )
    token = (
        db.query(DevicePushToken)
        .filter(DevicePushToken.user_id == current_user.id, DevicePushToken.token == payload.token)
        .first()
    )
    if token:
        token.is_active = False
        db.commit()
    return ok({"registered": False}, "FCM token disabled")


@router.post("/logout")
def logout():
    return ok({"logged_out": True}, "JWT is stateless; remove token client-side")
