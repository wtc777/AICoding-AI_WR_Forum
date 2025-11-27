from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.api import deps
from app.core.config import get_settings
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])


class AIConfigUpdate(BaseModel):
    base_url: str | None = None
    model: str | None = None
    chat_completion_path: str | None = None
    default_params: dict | None = None


@router.get("/users")
def list_users(_: User = Depends(deps.require_admin), session: Session = Depends(deps.get_db)):
    return session.exec(select(User)).all()


@router.post("/users/{user_id}/ban")
def ban_user(user_id: int, _: User = Depends(deps.require_admin), session: Session = Depends(deps.get_db)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    session.add(user)
    session.commit()
    return {"banned": True}


@router.get("/ai-config")
def get_ai_config(_: User = Depends(deps.require_admin)):
    settings = get_settings()
    cfg = settings.load_ai_config()
    if not cfg:
        raise HTTPException(status_code=404, detail="ai.yaml not found")
    masked = cfg.model_dump()
    return masked


@router.patch("/ai-config")
def update_ai_config(payload: AIConfigUpdate, _: User = Depends(deps.require_admin)):
    settings = get_settings()
    cfg_path = settings.ai_config_path
    existing = settings.load_ai_config()
    data = existing.model_dump() if existing else {}
    update_data = payload.model_dump(exclude_none=True)
    data.update(update_data)
    cfg_path.parent.mkdir(parents=True, exist_ok=True)
    cfg_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return data


@router.get("/ai/test")
async def test_ai(_: User = Depends(deps.require_admin)):
    # Minimal ping that reports configured model name.
    settings = get_settings()
    cfg = settings.load_ai_config()
    if not cfg:
        return {"status": "missing_config"}
    return {"status": "ok", "model": cfg.model, "base_url": cfg.base_url}
