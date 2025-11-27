from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api import deps
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenPair, UserRead
from app.utils.security import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead)
def register(payload: RegisterRequest, session: Session = Depends(deps.get_db)):
    existing = session.exec(select(User).where(User.email == payload.email)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        nickname=payload.nickname or payload.email.split("@")[0],
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.post("/login", response_model=TokenPair)
def login(payload: LoginRequest, session: Session = Depends(deps.get_db), _: None = Depends(deps.rate_limit_login)):
    user = session.exec(select(User).where(User.email == payload.email)).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    tokens = deps.issue_token_pair(user)
    return TokenPair(**tokens)


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(deps.get_current_user)):
    return current_user


@router.post("/refresh", response_model=TokenPair)
def refresh_token(current_user: User = Depends(deps.get_current_user)):
    # Token type check is omitted for simplicity; in production verify "type" == "refresh"
    tokens = deps.issue_token_pair(current_user)
    return TokenPair(**tokens)
