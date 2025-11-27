from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel


class CardInfo(BaseModel):
    name: str
    code: Optional[str] = None
    position: Optional[str] = None
    confidence: Optional[float] = None


class ReadingCreate(BaseModel):
    card_type: str
    scene_desc: str


class ReadingRead(BaseModel):
    id: int
    card_type: str
    scene_desc: str
    ai_response: str
    cards_json: Any
    image_urls: List[str] | None = None
    created_at: datetime

    class Config:
        from_attributes = True
