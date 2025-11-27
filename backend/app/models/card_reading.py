from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel, ForeignKey, Relationship
from app.models.user import User


class CardReading(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    card_type: str = Field(default="")
    scene_desc: str = Field(default="")
    ai_response: str = Field(default="")
    cards_json: Any = Field(default=None, sa_column=Column(JSON))
    image_urls: Any = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    user: User = Relationship()
