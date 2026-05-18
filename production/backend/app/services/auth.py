from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User


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


def _decode_legacy_token(token: str, settings) -> str | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
        return str(user_id) if user_id else None
    except JWTError:
        return None


def _decode_supabase_token(token: str, settings) -> dict[str, Any] | None:
    if not settings.supabase_jwt_secret:
        return None
    try:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience=settings.supabase_jwt_audience,
        )
    except JWTError:
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


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    settings = get_settings()
    credentials_error = _credentials_error()

    supabase_payload = _decode_supabase_token(token, settings)
    if supabase_payload:
        user = _find_supabase_user(db, supabase_payload)
        if not user or not user.is_active or user.deleted_at is not None:
            raise credentials_error
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
