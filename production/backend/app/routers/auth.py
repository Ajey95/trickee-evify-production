from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DevicePushToken, User
from app.schemas.api import ok
from app.services.auth import create_access_token, get_current_user, verify_password
from app.services.firebase_service import verify_firebase_id_token
from app.services.serializers import device_push_token_dict, user_dict

router = APIRouter(prefix="/auth", tags=["auth"])

LOGIN_WINDOW_MINUTES = 15
LOGIN_MAX_FAILURES = 8
WS_TICKET_TTL_MINUTES = 2
_login_failures: dict[str, list[datetime]] = {}


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class FirebaseLoginRequest(BaseModel):
    id_token: str


class FcmTokenRequest(BaseModel):
    token: str
    platform: str = "web"
    device_label: str | None = None


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


@router.post("/login")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    login_key = _assert_login_allowed(request, payload.email)
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        _record_login_failure(login_key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
    _login_failures.pop(login_key, None)
    return ok(_session_payload(user))


@router.post("/firebase-login")
def firebase_login(payload: FirebaseLoginRequest, db: Session = Depends(get_db)):
    decoded = verify_firebase_id_token(payload.id_token)
    firebase_uid = decoded.get("uid")
    email = decoded.get("email")
    if not firebase_uid or not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Firebase token must include uid and email")

    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Firebase user is not mapped in Trickee")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")

    if user.firebase_uid != firebase_uid or user.auth_provider != "firebase":
        user.firebase_uid = firebase_uid
        user.auth_provider = "firebase"
        db.commit()
        db.refresh(user)

    return ok(_session_payload(user))


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return ok(user_dict(current_user))


@router.get("/ws-ticket")
def ws_ticket(current_user: User = Depends(get_current_user)):
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
def register_fcm_token(
    payload: FcmTokenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
def unregister_fcm_token(
    payload: FcmTokenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
