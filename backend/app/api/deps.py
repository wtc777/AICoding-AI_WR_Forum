from __future__ import annotations

import time
from datetime import timedelta
from typing import Annotated, Dict

from fastapi import Depends, HTTPException, Header, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlmodel import Session, select

from app.core.config import get_settings
from app.db.session import get_session
from app.models.user import User
from app.utils.security import create_token

settings = get_settings()
auth_scheme = HTTPBearer(auto_error=False)


_rate_limit_store: Dict[str, list[float]] = {}


def _check_rate_limit(key: str, limit: int, period_seconds: int) -> None:
    now = time.time()
    entries = _rate_limit_store.get(key, [])
    entries = [ts for ts in entries if ts > now - period_seconds]
    if len(entries) >= limit:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded")
    entries.append(now)
    _rate_limit_store[key] = entries


def rate_limit_login() -> None:
    _check_rate_limit("login", settings.rate_limit_login_per_minute, 60)


def rate_limit_ai(user_id: int) -> None:
    _check_rate_limit(f"ai:{user_id}", settings.rate_limit_ai_per_hour, 3600)


def get_db() -> Session:
    with get_session() as session:
        yield session


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(auth_scheme)],
    session: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = session.get(User, int(user_id))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_current_user_optional(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(auth_scheme)],
    session: Session = Depends(get_db),
) -> User | None:
    if credentials is None:
        return None
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    user_id = payload.get("sub")
    if user_id is None:
        return None
    user = session.get(User, int(user_id))
    if user is None or not user.is_active:
        return None
    return user


def issue_token_pair(user: User) -> dict:
    access = create_token({"sub": str(user.id), "role": user.role, "type": "access"}, timedelta(minutes=settings.access_token_expire_minutes))
    refresh = create_token({"sub": str(user.id), "role": user.role, "type": "refresh"}, timedelta(days=settings.refresh_token_expire_days))
    return {"access_token": access, "refresh_token": refresh}


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user
