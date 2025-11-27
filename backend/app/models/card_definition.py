from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class CardDefinition(SQLModel, table=True):
    id: str = Field(primary_key=True, description="Stable card identifier")

    front_title: str
    front_english: str
    front_value: int
    front_color: str
    front_image: Optional[str] = None

    back_title: str
    back_english: str
    back_value: int
    back_color: str
    back_image: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
