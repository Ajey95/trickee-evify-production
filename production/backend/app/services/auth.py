from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from app.config import get_settings
from app.database import get_db
from app.models import AccessRequest, User


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def create_access_token(payload: dict[str, Any], expire_minutes: int | None = None) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes or settings.access_token_expire_minutes)
    to_encode = payload.copy()
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def _credentials_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _workspace_access_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Workspace access is pending approval",
    )


def _decode_legacy_token(token: str, settings) -> str | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
        return str(user_id) if user_id else None
    except JWTError:
        return None


def _decode_supabase_token(token: str, settings) -> dict[str, Any] | None:
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")
        
        if alg == "HS256" and settings.supabase_jwt_secret:
            return jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience=settings.supabase_jwt_audience,
            )
            
        if not settings.supabase_url or not settings.supabase_anon_key:
            return None
            
        # For ES256/RS256, verify the token is active by calling the Supabase Auth server.
        payload = jwt.decode(token, options={"verify_signature": False})
        with httpx.Client(timeout=4.0) as client:
            resp = client.get(
                f"{settings.supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.supabase_anon_key,
                },
            )
            if resp.status_code == 200:
                return payload
            return None
    except Exception:
        return None


def _find_supabase_user(db: Session, payload: dict[str, Any]) -> User | None:
    supabase_user_id = payload.get("sub")
    email = payload.get("email")
    user = None
    if supabase_user_id:
        user = db.query(User).filter(User.supabase_user_id == str(supabase_user_id)).first()
    if not user and email:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.supabase_user_id = str(supabase_user_id) if supabase_user_id else None
            user.auth_provider = "supabase"
            db.commit()
            db.refresh(user)
    return user


def record_supabase_access_request(db: Session, payload: dict[str, Any]) -> AccessRequest | None:
    email = payload.get("email")
    if not email:
        return None
    metadata = payload.get("user_metadata") or {}
    requested_role = metadata.get("requested_role") or metadata.get("role") or "fleet_operator"
    if requested_role not in {"fleet_operator", "driver", "trickee_admin"}:
        requested_role = "fleet_operator"
    full_name = metadata.get("full_name") or metadata.get("name") or email.split("@")[0]
    company = metadata.get("company") or metadata.get("fleet") or metadata.get("organization")
    row = db.query(AccessRequest).filter(AccessRequest.email == email).first()
    if not row:
        row = AccessRequest(email=email, full_name=full_name, company=company, requested_role=requested_role)
        db.add(row)
    row.supabase_user_id = str(payload.get("sub")) if payload.get("sub") else row.supabase_user_id
    row.full_name = full_name or row.full_name
    row.company = company or row.company
    if row.status == "pending":
        row.requested_role = requested_role
    db.commit()
    return row


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    settings = get_settings()
    credentials_error = _credentials_error()

    supabase_payload = _decode_supabase_token(token, settings)
    if supabase_payload:
        user = _find_supabase_user(db, supabase_payload)
        if not user or not user.is_active or user.deleted_at is not None:
            if not user:
                record_supabase_access_request(db, supabase_payload)
            raise _workspace_access_error()
        return user

    if not settings.legacy_auth_enabled:
        raise credentials_error

    user_id = _decode_legacy_token(token, settings)
    if not user_id:
        raise credentials_error

    user = db.get(User, user_id)
    if not user or not user.is_active or user.deleted_at is not None:
        raise credentials_error
    return user


def require_roles(*roles: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return current_user

    return dependency
